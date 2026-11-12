import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'weather-alerts';
let notificationsReady = false;
let channelReady = false;

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Alertas meteorológicas',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0EA5E9',
      });
      channelReady = true;
    } catch (error) {
      console.warn(
        'Canal de notificaciones no disponible; se usará el canal por defecto',
        error,
      );
    }
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    notificationsReady = status === 'granted';
    return notificationsReady;
  } catch (error) {
    console.warn('No se pudieron configurar las notificaciones', error);
    return false;
  }
}

export async function sendWeatherAlert(title: string, body: string): Promise<void> {
  if (!notificationsReady) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: false,
      },
      trigger:
        Platform.OS === 'android' && channelReady
          ? { channelId: CHANNEL_ID }
          : null,
    });
  } catch (error) {
    console.warn('No se pudo mostrar la notificación', error);
  }
}
