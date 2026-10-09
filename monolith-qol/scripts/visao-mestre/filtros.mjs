/**
 * Filtros e classes do canvas usados pela Visão do Mestre. Baseado no GM Vision 2.0.5 (MIT),
 * só o caminho da V13 (os ramos da V14 foram tirados).
 */

/** Listras diagonais sobre tokens que o Mestre vê, mas os jogadores não. */
export function criarFiltroDeteccao() {
  return class FiltroDeteccao extends foundry.canvas.rendering.filters.AbstractBaseFilter {
    static vertexShader = `
      attribute vec2 aVertexPosition;

      uniform vec4 inputSize;
      uniform vec4 outputFrame;
      uniform mat3 projectionMatrix;
      uniform vec2 origin;
      uniform mediump float thickness;

      varying vec2 vTextureCoord;
      varying float vOffset;

      void main() {
        vTextureCoord = (aVertexPosition * outputFrame.zw) * inputSize.zw;
        vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.0)) + outputFrame.xy;
        vec2 offset = position - origin;
        vOffset = (offset.x + offset.y) / (1.414213562373095 * 2.0 * thickness);
        gl_Position = vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
      }
    `;

    static fragmentShader = `
      varying vec2 vTextureCoord;
      varying float vOffset;

      uniform sampler2D uSampler;
      uniform mediump float thickness;

      void main() {
        float x = abs(vOffset - floor(vOffset + 0.5)) * 2.0;
        float y0 = clamp((x + 0.5) * thickness + 0.5, 0.0, 1.0);
        float y1 = clamp((x - 0.5) * thickness + 0.5, 0.0, 1.0);
        float y = y0 - y1;
        float alpha = texture2D(uSampler, vTextureCoord).a * 0.25;
        gl_FragColor = vec4(y, y, y, 1.0) * alpha;
      }
    `;

    static defaultUniforms = { origin: { x: 0.0, y: 0.0 }, thickness: 1.0 };

    /** @override */
    apply(filterManager, input, output, clearMode, currentState) {
      const u = this.uniforms;
      const wt = currentState.target.worldTransform;
      u.origin.x = wt.tx;
      u.origin.y = wt.ty;
      u.thickness = 4 * canvas.dimensions.uiScale * canvas.stage.scale.x;
      super.apply(filterManager, input, output, clearMode, currentState);
    }
  };
}

/** Clareia a iluminação quando a Visão do Mestre está ligada. */
export const mixinMascara = (Base) => class extends Base {
  static defaultUniforms = { ...super.defaultUniforms, gmVision: false };

  static fragmentHeader = `
    ${super.fragmentHeader}

    uniform bool gmVision;
  `;

  static fragmentPostProcess(postProcessModes) {
    return `
      ${super.fragmentPostProcess(postProcessModes)}

      if (mode == ${this.FILTER_MODES.ILLUMINATION} && gmVision) {
        finalColor.rgb = sqrt(finalColor.rgb) * 0.5 + 0.5;
      }
    `;
  }
};

/**
 * Token: com a Visão ligada, tokens fora da visão dos tokens controlados aparecem (com listras).
 * Tokens ocultos (hidden) também ganham listras, para o Mestre saber que os jogadores não os veem.
 * @param {() => {ativa: boolean, listras: boolean}} estado
 */
export const mixinToken = (Base, estado, Filtro) => {
  let filtro;
  return class extends Base {
    /** @override */
    get isVisible() {
      const visivel = super.isVisible; // o core zera this.detectionFilter aqui
      const { ativa, listras } = estado();
      if (listras && (!visivel || this.document.hidden)) this.detectionFilter = filtro ??= Filtro.create();
      if (!visivel && ativa && this._preview?.previewType !== "config"
        && canvas.effects.visionSources.some((s) => s.active)) return true;
      return visivel;
    }
  };
};
