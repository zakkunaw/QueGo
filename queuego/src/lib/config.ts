import config from '../../config.json';

export const appConfig = config as {
  nama_toko: string;
  warna_utama: string;
  logo_url: string;
  nomor_wa_admin: string;
  admin_password: string;
};

export function getPrimaryColorClasses() {
  const hex = appConfig.warna_utama.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return {
    primary: `rgb(${r} ${g} ${b})`,
    primaryHover: `rgb(${Math.max(0, r - 20)} ${Math.max(0, g - 20)} ${Math.max(0, b - 20)})`,
    primaryLight: `rgb(${Math.min(255, r + 40)} ${Math.min(255, g + 40)} ${Math.min(255, b + 40)})`,
  };
}