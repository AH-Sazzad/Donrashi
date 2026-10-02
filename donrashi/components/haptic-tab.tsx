import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { style, onPress, onLongPress, children, accessibilityState, accessibilityLabel } = props;
  return (
    <Pressable
      style={style}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}>
      {children}
    </Pressable>
  );
}
