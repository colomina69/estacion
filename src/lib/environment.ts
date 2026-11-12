import Constants from 'expo-constants';

import type { MqttTransportType, Settings } from '../types/weather';

export function isExpoGo(): boolean {
  return Constants.expoGoConfig != null || Constants.appOwnership === 'expo';
}

export function effectiveTransport(settings: Settings): MqttTransportType {
  return isExpoGo() ? 'ws' : settings.transport;
}
