import { VisClasses, VisualizerModule } from "../modules/visualizer.mjs";
import { FaultType, FaultLevel } from "../modules/faultbus.mjs";

const NON_GATEWAY_MULTIPLE_OUT = 'Multiple outgoing flows';

let visualizerModule = new VisualizerModule(
    FaultType.NON_GATEWAY_MULTIPLE_OUT,
    FaultLevel.INFO,
    function (type, process, elements, visualizer, modeler) {
        let ui = elements.getUI$;
        visualizer.addClass(ui, [ VisClasses.VISUALIZED_LINE, VisClasses.INFO_LINE ]);
        let closerAction = () => {};
        visualizer.addOverlay(elements.getUI$, type, NON_GATEWAY_MULTIPLE_OUT, (panel) => {
            visualizer.fadeOut();
            visualizer.addClass(ui, VisClasses.NON_FADE, true);

            closerAction = this.getExplanation(panel, elements, modeler);
        }, () => { closerAction(); });
    },
    function (panel, information, modeler) {

        return () => { };
    }
);

export { visualizerModule };