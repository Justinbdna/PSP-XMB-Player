import { useEffect } from 'react';

export interface GamepadCallbacks {
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
  onCross: () => void;
  onCircle: () => void;
  onSquare: () => void;
  onTriangle: () => void;
  onSelect: () => void;
  onStart: () => void;
  onHome: () => void;
  onL?: () => void;
  onR?: () => void;
}

export const useGamepad = (callbacks: GamepadCallbacks) => {
  useEffect(() => {
    let animId: number;
    let prevButtons: boolean[] = [];
    let prevAxes: [number, number] = [0, 0];

    const poll = () => {
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      const gp = gamepads[0];

      if (gp) {
        const press = (idx: number, fn?: () => void) => {
          if (!fn) return;
          const isPressed = gp.buttons[idx]?.pressed ?? false;
          if (isPressed && !prevButtons[idx]) {
            fn();
          }
        };

        // Standard Gamepad API Mapping:
        // 0: Cross (✕ / A)
        // 1: Circle (◯ / B)
        // 2: Square (□ / X)
        // 3: Triangle (△ / Y)
        // 4: L Shoulder Trigger
        // 5: R Shoulder Trigger
        // 8: Select / Back
        // 9: Start
        // 12: D-Pad Up
        // 13: D-Pad Down
        // 14: D-Pad Left
        // 15: D-Pad Right
        // 16: Guide / Home Button
        press(0, callbacks.onCross);
        press(1, callbacks.onCircle);
        press(2, callbacks.onSquare);
        press(3, callbacks.onTriangle);
        press(4, callbacks.onL);
        press(5, callbacks.onR);
        press(8, callbacks.onSelect);
        press(9, callbacks.onStart);
        press(12, callbacks.onUp);
        press(13, callbacks.onDown);
        press(14, callbacks.onLeft);
        press(15, callbacks.onRight);
        press(16, callbacks.onHome);

        // Analog stick axes
        const axX = gp.axes[0] ?? 0;
        const axY = gp.axes[1] ?? 0;

        if (axX < -0.5 && prevAxes[0] >= -0.5) callbacks.onLeft();
        if (axX > 0.5 && prevAxes[0] <= 0.5) callbacks.onRight();
        if (axY < -0.5 && prevAxes[1] >= -0.5) callbacks.onUp();
        if (axY > 0.5 && prevAxes[1] <= 0.5) callbacks.onDown();

        prevButtons = gp.buttons.map((b) => b?.pressed ?? false);
        prevAxes = [axX, axY];
      }

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [callbacks]);
};

