import { VisualizerModule } from "../modules/vismodule.mjs";
import { StandardFaultType as FaultType } from "../modules/stfaulttypes.mjs";
import { FaultLevel } from "../modules/faultbus.mjs";

const NON_GATEWAY_MULTIPLE_OUT = 'Multiple outgoing flows';

let visualizerModule = new VisualizerModule(
    FaultType.NON_GATEWAY_MULTIPLE_OUT,
    FaultLevel.INFO,
    function (type, process, elements, visualizer, modeler) {
        visualizer.addInfoLine(elements.getUI$);
        let closerAction = () => {};
        visualizer.addOverlay(elements.getUI$, type, NON_GATEWAY_MULTIPLE_OUT, (panel) => {
            visualizer.setFocus(null, elements.getUI$);

            closerAction = this.getExplanation(panel, elements, modeler);
        }, () => { closerAction(); });
    },
    function (panel, information, modeler) {

        return () => { };
    }
);

export { visualizerModule };