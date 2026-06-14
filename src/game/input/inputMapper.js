import Phaser from "phaser";

const KEY_BINDINGS = {
  left: "A",
  right: "D",
  down: "S",
  jump: "SPACE",
  light: "J",
  heavy: "K",
  removedUp: "W",
  removedSpecial: "L",
  removedDodge: "SHIFT",
  removedShield: "I"
};

export function createKeyboardInput(scene) {
  const keys = scene.input.keyboard.addKeys(KEY_BINDINGS);
  const justDown = Phaser.Input.Keyboard.JustDown;

  return function readKeyboardInput() {
    return {
      left: keys.left.isDown,
      right: keys.right.isDown,
      down: keys.down.isDown,
      jump: justDown(keys.jump),
      light: justDown(keys.light),
      heavy: justDown(keys.heavy)
    };
  };
}
