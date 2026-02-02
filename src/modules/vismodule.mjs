class VisualizerModule {
    #faultType;
    #errorLevel;
    #visualizer;
    #explanation;
    #classes;

    constructor(faultType, errorLevel, visualizer = () => {}, explanation = () => {}, classes = []) {
        this.#faultType = faultType;
        this.#errorLevel = errorLevel;
        this.#visualizer = visualizer;
        this.#explanation = explanation;
        this.#classes = classes;
    }

    get getFaultType() {
        return this.#faultType;
    }
    get getErrorLevel() {
        return this.#errorLevel;
    }
    get getVisualizer() {
        return this.#visualizer;
    }
    get getExplanation() {
        return this.#explanation;
    }
    get getClasses() {
        return this.#classes;
    }
}

export { VisualizerModule };