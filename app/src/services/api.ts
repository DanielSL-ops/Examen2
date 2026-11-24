import { ErrorApi } from './errores';
import { obtenerToken, olvidarSesion } from '@/composables/useAuth';
import router from '@/router';

const BASE_URL = import.meta.env.VITE_API_URL;
const TIEMPO_MAXIMO_MS = 10_000;

export interface OpcionesApi {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

/**
 * TODO [M1] Cliente HTTP único de la aplicación (8 pts).
 *
 * api<T>(ruta, { method, body, params }) debe:
 *  1. Construir la URL como BASE_URL + ruta y agregar como query string solo los params
 *     que tengan valor (ni undefined ni '').           ej. api('/equipos', { params: { page: 2, q: '' } })
 *  2. Enviar siempre "Accept: application/json".
 *  3. Si hay token (obtenerToken()), enviar "Authorization: Bearer <token>". Nunca en la URL.
 *  4. Si hay body, enviarlo como JSON ("Content-Type: application/json" + JSON.stringify).
 *  5. Cancelar la petición si tarda más de TIEMPO_MAXIMO_MS (AbortController).
 *     Si fetch falla sin respuesta (sin red, tiempo agotado, CORS), lanzar
 *     new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' }).
 *  6. Si la respuesta es 204, devolver null.
 *  7. Si response.ok es false, lanzar new ErrorApi(status, cuerpoJson).
 *     Si el estado es 401 (y la ruta no es /login): await olvidarSesion() y router.replace('/login').
 *  8. En cualquier otro caso, devolver el cuerpo JSON.
 */
export async function api<T = unknown>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  const url = new URL(BASE_URL + ruta);
  for (const [clave, valor] of Object.entries(opciones.params ?? {})) {
    if (valor !== undefined && valor !== '') {
      url.searchParams.set(clave, String(valor));
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = obtenerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (opciones.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const body = opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined;
  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), TIEMPO_MAXIMO_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: opciones.method ?? 'GET',
        headers,
        body,
        signal: controller.signal,
      });
    } catch {
      throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
    }

    if (response.status === 204) return null as T;

    const cuerpo = await response.json();
    if (!response.ok) {
      if (response.status === 401 && ruta !== '/login') {
        await olvidarSesion();
        await router.replace('/login');
      }
      throw new ErrorApi(response.status, cuerpo);
    }
    return cuerpo as T;
  } finally {
    clearTimeout(temporizador);
  }
}
