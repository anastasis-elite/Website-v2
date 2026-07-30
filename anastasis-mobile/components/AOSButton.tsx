import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { colors, radii } from '../lib/theme'

type Props = {
  children: ReactNode
  onPress?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

export default function AOSButton({
  children,
  onPress,
  variant = 'primary',
  disabled,
}: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant !== 'primary' && styles.secondaryText,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    backgroundColor: colors.copper,
    paddingHorizontal: 18,
  },
  secondary: {
    borderWidth: 1,
    borderColor: 'rgba(230,107,56,0.42)',
    backgroundColor: 'rgba(126,34,14,0.08)',
  },
  danger: {
    borderWidth: 1,
    borderColor: 'rgba(220,63,52,0.35)',
    backgroundColor: 'rgba(120,25,16,0.14)',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    color: '#180B06',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  secondaryText: {
    color: '#F0C4AB',
  },
})
