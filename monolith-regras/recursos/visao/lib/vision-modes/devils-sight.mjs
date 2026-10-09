/**
 * The vision mode for Devil's Sight.
 */
export default class VisionModeDevilsSight extends foundry.canvas.perception.VisionMode {
    constructor() {
        super({
            id: "devilsSight",
            label: "MONOLITH.visao.DevilsSight",
            vision: {
                darkness: { adaptive: false },
                defaults: { contrast: 0, saturation: 0, brightness: 1 },
            },
        });
    }
}
