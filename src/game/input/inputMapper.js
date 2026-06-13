import Phaser from "phaser";

const KEY_BINDINGS = {
  left: "A",
  right: "D",
  up: "W",
  down: "S",
  jump: "SPACE",
  light: "J",
  heavy: "K",
  special: "L",
  dodge: "SHIFT",
  shield: "I"
};

export function createKeyboardInput(scene) {
  const keys = scene.input.keyboard.addKeys(KEY_BINDINGS);
  const justDown = Phaser.Input.Keyboard.JustDown;

  return function readKeyboardInput() {
    const lightPressed = justDown(keys.light);
    const upAttack = keys.up.isDown && lightPressed;

    return {
      left: keys.left.isDown,
      right: keys.right.isDown,
      up: upAttack,
      down: keys.down.isDown,
      jump: justDown(keys.up) || justDown(keys.jump),
      light: lightPressed && !upAttack,
      heavy: justDown(keys.heavy),
      special: justDown(keys.special),
      dodge: justDown(keys.dodge),
      shield: keys.shield.isDown
    };
  };
}
