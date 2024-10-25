import * as fs from '../platform/server/fs';

type ServerConfig = {
  BASE_SERVER: string;
  SYNC_SERVER: string;
  SIGNUP_SERVER: string;
  GOCARDLESS_SERVER: string;
  SIMPLEFIN_SERVER: string;
};

let config: ServerConfig | null = null;

function joinURL(base: string | URL, ...paths: string[]): string {
  const url = new URL(base);
  url.pathname = fs.join(...paths);
  return url.toString();
}

export function setServer(url: string): void {
  if (url == null) {
    config = null;
  } else {
    config = getServer(url);
  }
}

// `url` is optional; if not given it will provide the global config
export function getServer(url?: string): ServerConfig | null {
  if (url) {
    try {
      return {
        BASE_SERVER: url,
        SYNC_SERVER: joinURL(url, '/sync'),
        SIGNUP_SERVER: joinURL(url, '/account'),
        GOCARDLESS_SERVER: joinURL(url, '/gocardless'),
        SIMPLEFIN_SERVER: joinURL(url, '/simplefin'),
      };
    } catch (error) {
      console.warn(
        'Unable to parse server URL - using the global config.',
        error,
        config,
      );
      return config;
    }
  }
  return config;
}
