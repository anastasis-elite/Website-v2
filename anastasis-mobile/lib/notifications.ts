import { router } from 'expo-router'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function configureNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('concierge', {
      name: 'Concierge prompts',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const existing = await Notifications.getPermissionsAsync()
  const finalStatus =
    existing.status === 'granted'
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status

  return finalStatus === 'granted'
}

export function observeNotificationNavigation() {
  function redirect(notification: Notifications.Notification) {
    const url = notification.request.content.data?.url

    if (typeof url === 'string') {
      router.push(url as never)
    }
  }

  const lastResponse = Notifications.getLastNotificationResponse()

  if (lastResponse?.notification) {
    redirect(lastResponse.notification)
  }

  return Notifications.addNotificationResponseReceivedListener((response) => {
    redirect(response.notification)
  })
}

export async function scheduleTestConciergeNotification() {
  const allowed = await configureNotifications()

  if (!allowed) {
    throw new Error('Notifications are not enabled for this app.')
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Anastasis check-in',
      body: 'Open today and continue with the next action.',
      data: {
        url: '/today',
        action: 'open_today',
      },
      categoryIdentifier: 'concierge',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    },
  })
}
