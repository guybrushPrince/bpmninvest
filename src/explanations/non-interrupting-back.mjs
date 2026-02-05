import { VisualizerModule } from "../modules/vismodule.mjs";
import { StandardFaultType as FaultType } from "../modules/stfaulttypes.mjs";
import { FaultLevel } from "../modules/faultbus.mjs";
import {asList, asObject, union} from "../modules/settools.mjs";
import {FaultKind} from "../modules/faultkind.mjs";
import $ from "jquery";

const NON_INTERRUPTING_BACK = 'Improper non-interrupting event';

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

                closerAction = this.getExplanation(panel, type, elements, visualizer, modeler, process);
            }, () => { closerAction(); });
        });
    },
    function (panel, fType, information, visualizer, modeler) {

        panel.append('<h1>Non-interrupting Boundary Event gets back to Main Process</h1>');
        visualizer.appendFaultKind(panel, [
            { type: fType, kind: FaultKind.STRUCTURAL_FAULT },
            { type: fType, kind: FaultKind.SEMANTIC_FAULT },
            { type: FaultLevel.INFO, kind: FaultKind.NO_BEST_PRACTICE }
        ]);

        panel.append('<h2>Explanation</h2>');

        panel.append('<h2>Flaw in your process model</h2>');

        panel.append('<h2>Repair suggestions</h2>');

        panel.append('<h2>Simulation (Experimental)</h2>');
        panel.append('<p>You can execute your process model and a simulation tries to cause the undesired behavior in ' +
            'your process model. <strong>The flaw is not guaranteed to happen.</strong> This does not mean that your process ' +
            'model does not contain the flaw. This just means that:</p>');
        panel.append('<ol>' +
            '<li>a previous flaw hinders the current one (e.g., a deadlock),</li>' +
            '<li>a previous flaw cover the current one, or</li>' +
            '<li>the simulator is unable yet to reproduce the flaw.</li></ol>');
        panel.append('<p>Using the simulation is experimental and will be further revised.</p>');


        let simButton = $('<button id="startSimulation">Start simulation</button>');
        panel.append(simButton);

        let message = $('<div class="simulation-hint"></div>');
        panel.append(message);

        panel.append('<h2>References:</h2>');
        panel.append('<blockquote>' +
            'Object Management Group (OMG)<br>' +
            '<a href="https://www.omg.org/spec/BPMN/2.0.2/PDF" target="_blank">Business Process Model and Notation (BPMN).</a><br>' +
            'Version 2.0.2 (December 2013).' +
            '</blockquote>');
        panel.append('<blockquote>' +
            'Marlon Dumas, Marcello La Rosa, Jan Mendling, Hajo A. Reijers<br>' +
            '<a href="https://doi.org/10.1007/978-3-662-56509-4" target="_blank">Fundamentals of Business Process Management.</a><br>' +
            'Second Edition. Springer 2018, ISBN 978-3-662-56508-7, pp. 181-187.' +
            '</blockquote>');

        return () => { };
    }
);

export { visualizerModule };