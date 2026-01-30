import { VisClasses, VisualizerModule } from "../modules/visualizer.mjs";
import { FaultType, FaultLevel } from "../modules/faultbus.mjs";
import { asList } from "../modules/settools.mjs";

const NON_INTERRUPTING_BACK = 'Possible missing synchronization';

let visualizerModule = new VisualizerModule(
    FaultType.NON_INTERRUPTING_BACK,
    FaultLevel.INFO,
    function (type, process, elements, visualizer, modeler) {
        let boundaries = elements.boundaries;
        let paths = elements.paths;
        asList(boundaries).forEach((b) => {
            visualizer.addClass(b.getUI$, [ VisClasses.VISUALIZED_LINE, VisClasses.WARNING_LINE ]);

            let closerAction = () => {};
            visualizer.addOverlay(b.getUI$, type, NON_INTERRUPTING_BACK, (panel) => {
                visualizer.fadeOut();
                visualizer.addClass(visualizer.mapModelToBPMNUI(paths), VisClasses.NON_FADE, true);
                visualizer.addClass(visualizer.mapModelToBPMNUI(paths), [ VisClasses.VISUALIZED_LINE,
                    VisClasses.WARNING_LINE, VisClasses.NON_FADE], VisClasses.NON_FADE);
                visualizer.addClass(b.getUI$, VisClasses.NON_FADE, true);

                closerAction = this.getExplanation(panel, elements, modeler, process);
            }, () => { closerAction(); });
        });
    },
    function (panel, information, modeler) {

        return () => { };
    }
);

export { visualizerModule };