import { VisClasses, VisualizerModule } from "../modules/visualizer.mjs";
import { FaultType, FaultLevel } from "../modules/faultbus.mjs";
import { PathFinderFactory } from "../modules/pathfinder.mjs";
import { asList, asObject } from "../modules/settools.mjs";
import { TokenSimulationHandling } from "../modules/simsupport.mjs";
import $ from "jquery";

const IMPLICIT_END = 'Implicit end event';

let visualizerModule = new VisualizerModule(
    FaultType.IMPLICIT_END,
    FaultLevel.INFO,
    function (type, process, elements, visualizer, modeler) {
        elements.implicitEnd.forEach(el => {
            let ui = el.getUI$;
            visualizer.addClass(ui, [VisClasses.VISUALIZED_LINE, VisClasses.INFO_LINE]);
            let closerAction = () => {};
            visualizer.addOverlay(el.getUI$, type, IMPLICIT_END, (panel) => {
                visualizer.fadeOut();
                visualizer.addClass(ui, VisClasses.NON_FADE, true);

                closerAction = this.getExplanation(panel, elements, modeler);
            }, () => { closerAction(); });
        });
    },
    function (panel, information, modeler) {
        let implicitEnd = information.implicitEnd[0];
        let path = information.simulation.path;
        let pathFinder = PathFinderFactory(modeler);
        let processElement = pathFinder.mapNodeSetToBPMN(asObject(information.implicitEnd)).concat([]);
        let bpmnPath = pathFinder.modelPathToBPMNPath(path);

        processElement = processElement.shift();
        panel.append('<h1>Process Model has an Implicit End Event</h1>');

        panel.append('<h2>Explanation</h2>');
        panel.append('<p>Following the BPMN 2.0.2 specification, it is allowed that a BPMN process model may have an ' +
            '<em>implicit end event</em>. An <em>implicit end event</em> is a node being no end event but which ' +
            'also does not have any outgoing sequence flow. </p>');
        panel.append('<p>Although it is indeed possible to use <em>implicit end events</em> it is not recommended and' +
            'is not seen as a good practice. You should always stay as explicit as possible to simplify the understanding ' +
            'of your process model. For this reason, explicitely use </em>end events</em> in your process models.' +
            '</p>');

        let type = processElement.type.substring(5);

        panel.append('<h2>Flaw in your process model</h2>');
        panel.append('<p>Your process model contains the blue highlighted <em>implicit end event</em> that you ' +
            'have modelled as a <a data-element-link=\'' + JSON.stringify(asList(implicitEnd.elementIds)) + '\'>' +
            type  + '</a>.</p>');

        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>' +
            'Please insert an <em>explicit end event</em> after the <em>implicit end Event</em>.' +
            '</p>');


        panel.append('<h2>Simulation (Experimental)</h2>');
        panel.append('<p>You can execute your process model and a simulation tries to execute the implicit end event in ' +
            'your process model. <strong>It is not guaranteed to happen.</strong> This does not mean that your process ' +
            'model does not contain the flaw. This just means that:</p>');
        panel.append('<ol>' +
            '<li>a previous flaw hinders the current one (e.g., a deadlock),</li>' +
            '<li>a previous flaw cover the current one, or</li>' +
            '<li>the simulator is unable yet to reproduce the flaw.</li></ol>');
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


        let simHandler = TokenSimulationHandling(modeler);
        simHandler.start();
        simHandler.pauseIfEntered(implicitEnd, function () {
            message.append('<p>At this moment, the implicit end event is reached by the execution.</p>');
        });

        simHandler.setDecisions(bpmnPath);

        simButton.on('click', function () {
            simHandler.controlElement(bpmnPath[0]);
            $('.simulation-hint').empty();
        });


        return () => { simHandler.stop(); };
    }
);

export { visualizerModule };