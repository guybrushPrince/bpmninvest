import { VisualizerModule } from "../modules/visualizer.mjs";
import { FaultType, FaultLevel } from "../modules/faultbus.mjs";
import {asList, asObject, union} from "../modules/settools.mjs";

const NON_INTERRUPTING_BACK = 'Possible missing synchronization';

let visualizerModule = new VisualizerModule(
    FaultType.NON_INTERRUPTING_BACK,
    FaultLevel.INFO,
    function (type, process, elements, visualizer, modeler) {
        let boundaries = elements.boundaries;
        let paths = elements.paths;
        asList(boundaries).forEach((b) => {
            visualizer.addWarningLine(b.getUI$);
            let closerAction = () => {};
            visualizer.addOverlay(b.getUI$, type, NON_INTERRUPTING_BACK, (panel) => {
                b = asObject([ b ]);
                visualizer.setFocus(
                    visualizer.mapModelToBPMNUI(paths),
                    visualizer.mapModelToBPMNUI(union(b, paths)),
                    true,
                    true
                );

                closerAction = this.getExplanation(panel, elements, modeler, process);
            }, () => { closerAction(); });
        });
    },
    function (panel, information, modeler) {

        return () => { };
    }
);

export { visualizerModule };