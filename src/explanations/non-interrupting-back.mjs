import { VisualizerModule } from "../modules/vismodule.mjs";
import { StandardFaultType as FaultType } from "../modules/stfaulttypes.mjs";
import { FaultLevel } from "../modules/faultbus.mjs";
import { asList, asObject, union } from "../modules/settools.mjs";
import { FaultKind } from "../modules/faultkind.mjs";
import $ from "jquery";
import { TokenSimulationHandling } from "../modules/simsupport.mjs";
import {PathFinderFactory} from "../modules/pathfinder.mjs";

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
                let bvis = asObject([ b ]);
                visualizer.setFocus(
                    visualizer.mapModelToBPMNUI(paths),
                    visualizer.mapModelToBPMNUI(union(bvis, paths)),
                    true,
                    true
                );

                closerAction = this.getExplanation(panel, type, b, elements, visualizer, modeler, process);
            }, () => { closerAction(); });
        });
    },
    function (panel, fType, boundary, information, visualizer, modeler) {

        panel.append('<h1>Non-interrupting Boundary Event gets back to Main Process</h1>');
        visualizer.appendFaultKind(panel, [
            { type: fType, kind: FaultKind.STRUCTURAL_FAULT },
            { type: fType, kind: FaultKind.SEMANTIC_FAULT },
            { type: FaultLevel.INFO, kind: FaultKind.NO_BEST_PRACTICE }
        ]);

        panel.append('<h2>Explanation</h2>');
        panel.append('<p><em>Boundary events</em> in BPMN are used for catching exceptional behavior in a process ' +
            'model. They are attached to <em>tasks</em>. Whereas <em>interrupting boundary events</em> stops the ' +
            'execution of the <em>task</em>, <em>non-</em>interrupting boundary events are thrown without stopping ' +
            'task. For this reason, concurrency appears.</p>')
        panel.append('<p>One difficulty of <em>non-interrupting boundary events</em> is that they can fire more ' +
            'than once by the BPMN specification. Consequently, if it is not guaranteed that such boundary event only ' +
            'fires at most once, there should <em>not</em> be a way back into the "normal" control-flow. Otherwise, ' +
            'improper synchronizations of the tokens are possible.</p>');
        panel.append('<p><em>Hint:</em> Assume that each non-interrupting boundary event is a start event of a ' +
            'separate process model being just presented in the same diagram as your process model. Thus, each ' +
            'firing of your non-interrupting event creates a new instance of your error handling process model.</p>')

        let boundaryLink = visualizer.getElementLink(boundary);
        let taskLink = visualizer.getElementLink(information.task);
        let intersectionLink = visualizer.getElementLink(information.intersections);

        panel.append('<h2>Flaw in your process model</h2>');
        panel.append('<p>In your process model, ' + taskLink + ' has the boundary event ' + boundaryLink + '. ' +
            boundaryLink + ' has the yellow blinking path back into the main control-flow at ' + intersectionLink +
            '. Everytime when ' + boundaryLink + ' is fired, all tasks on the path and all tasks downstream of ' +
            intersectionLink + ' can be executed multiple times.</p>');

        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>Please investigate your ' + taskLink + ' and ' + boundaryLink + ' whether ' + boundaryLink +
            ' could fire more than once. If it can fire up to once, you can leave your process model (for this case) ' +
            'as is.</p>');
        panel.append('<p>Otherwise, you can insert a new end event besides ' + intersectionLink + '. Subsequently, ' +
            'you redirect each yellow blinking incoming sequence flow of ' + intersectionLink + ' to this new end ' +
            'event. This ensures that no token will go back into the main control-flow.</p>');
        panel.append('<p>Please be aware that this changes the behavior of your process model and the your ' +
            'exception handling started with ' + boundaryLink + ' is totally concurrent to the rest of your ' +
            'process model.</p>');

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

        // Token simulation
        let simInformation = information.simulation;

        let simHandler = TokenSimulationHandling(modeler);
        simHandler.start();

        // Set decisions for the paths to the task node:
        let pathToTask = PathFinderFactory(modeler).modelPathToBPMNPath(simInformation.pathToTask);
        let pathToIntersections = asList(simInformation.pathToIntersections);
        let bpmnPathToIntersections = PathFinderFactory(modeler).modelPathToBPMNPath(pathToIntersections);
        simHandler.setDecisions(pathToTask);
        simHandler.setDecisions(bpmnPathToIntersections, true);

        simHandler.pauseIfEntered(information.task, (node) => {
            message.append('<p>From this moment, each firing of ' + boundaryLink + ' will lead to an addition token.</p>');
        }, false);

        asList(information.intersections).forEach((intersection) => {
            simHandler.pauseIfExited(intersection, (node) => {
                message.append('<p>All tasks after ' + intersectionLink + ' will be executed twice.</p>');
            });
        });

        simButton.on('click', function () {
            simHandler.controlElement(pathToTask[0]);
            $('.simulation-hint').empty();
        });

        return () => { simHandler.stop(); };
    }
);

export { visualizerModule };