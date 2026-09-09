import template from '../../firmware/soda-basic-template.ino?raw';

/** Protocol 1 and the SODA v2 board pin map; no embedded API credentials. */
export function generateSodabotFirmware(
  robotName: string, wifiSsid: string, wifiPass: string,
  _apiKey = '', _apiHost = ''
): string {
  const name = robotName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10) || 'ROBOT';
  const substitutions: Record<string, string> = {
    __SODA_WIFI_SSID__: JSON.stringify(wifiSsid),
    __SODA_WIFI_PASSWORD__: JSON.stringify(wifiPass),
    __SODA_BLE_NAME__: JSON.stringify(`SODABOT_${name}`),
  };
  return template.replace(/__SODA_WIFI_SSID__|__SODA_WIFI_PASSWORD__|__SODA_BLE_NAME__/g, key => substitutions[key]);
}
