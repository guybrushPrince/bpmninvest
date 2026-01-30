import { VisClasses, VisualizerModule } from "../modules/visualizer.mjs";
import { FaultType, FaultLevel } from "../modules/faultbus.mjs";

const NON_GATEWAY_MULTIPLE_IN = 'Multiple incoming flows';

let visualizerModule = new VisualizerModule(
    FaultType.NON_GATEWAY_MULTIPLE_IN,
    FaultLevel.INFO,
    function (type, process, elements, visualizer, modeler) {
        let ui = elements.getUI$;
        visualizer.addClass(ui, [ VisClasses.VISUALIZED_LINE, VisClasses.INFO_LINE ]);
        let closerAction = () => {};
        visualizer.addOverlay(elements.getUI$, type, NON_GATEWAY_MULTIPLE_IN, (panel) => {
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