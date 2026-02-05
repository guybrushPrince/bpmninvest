import { VisualizerModule } from "../modules/vismodule.mjs";
import { StandardFaultType as FaultType } from "../modules/stfaulttypes.mjs";
import { FaultLevel } from "../modules/faultbus.mjs";
import { PathFinderFactory } from "../modules/pathfinder.mjs";
import { asList, asObject } from "../modules/settools.mjs";
import { TokenSimulationHandling } from "../modules/simsupport.mjs";
import $ from "jquery";
import {FaultKind} from "../modules/faultkind.mjs";

const IMPLICIT_START = 'Implicit start event';

let visualizerModule = new VisualizerModule(
    FaultType.IMPLICIT_START,
    FaultLevel.INFO,
    function (type, process, elements, visualizer, modeler) {
        elements.implicitStart.forEach(el => {
            visualizer.addInfoLine(el.getUI$);
            let closerAction = () => {};
            visualizer.addOverlay(el.getUI$, type, IMPLICIT_START, (panel) => {
                visualizer.setFocus(null, el.getUI$);

                closerAction = this.getExplanation(panel, type, elements, visualizer, modeler);
            }, () => { closerAction(); });
        });
    },
    function (panel, fType, information, visualizer, modeler) {
        let implicitStart = information.implicitStart[0];
        let explicitStarts = asList(information.simulation.starts);

        panel.append('<h1>Process Model has an Implicit Start Event</h1>');
        visualizer.appendFaultKind(panel, { type: fType, kind: FaultKind.NO_BEST_PRACTICE });

        panel.append('<h2>Explanation</h2>');
        panel.append('<p>Following the BPMN 2.0.2 specification, it is allowed that a BPMN process model may have an ' +
            '<em>implicit start event</em>. An <em>implicit start event</em> is a node being no start event but which ' +
            'also does not have an incoming sequence flow. All <em>implicit start event</em>s are executed once the ' +
            'process model is instantiated.</p>');
        panel.append('<p>Although it is indeed possible to use <em>implicit start events</em> it is not recommended and' +
            'is not seen as a good practice. You should always stay as explicit as possible to simplify the understanding ' +
            'of your process model. For this reason, explicitely use </em>start events</em> in your process models.' +
            '</p>');

        let link = visualizer.getElementLink(implicitStart);

        panel.append('<h2>Flaw in your process model</h2>');
        panel.append('<p>Your process model contains the blue highlighted <em>implicit start event</em> that you ' +
            'have modelled as a ' + link  + '.</p>');

        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>' +
            'Please insert an <em>explicit start event</em> before the <em>implicit start event</em>. If your process ' +
            'model contains multiple <em>start event</em>s now, ensure that you combine those <em>start event</em>s, ' +
            'which together shall be the starting points during instantiation, to ' +
            'a single one by adding a converging <em>Parallel Gateway</em>.' +
            '</p>');


        let closerAction = () => {};
        if (explicitStarts.length > 0) {
            panel.append('<h2>Simulation (Experimental)</h2>');
            panel.append('<p>You can execute your process model and a simulation shows how the implicit start event is ' +
                'executed.</p>');
            let simButton = $('<button id="startSimulation">Start simulation</button>');
            panel.append(simButton);

            let message = $('<div class="simulation-hint"></div>');
            panel.append(message);

            let simHandler = TokenSimulationHandling(modeler);
            simHandler.start();
            simHandler.pauseIfEntered(implicitStart, function () {
                message.append('<p>At this moment, the implicit start event is executed.</p>');
            });

            simButton.on('click', function () {
                simHandler.controlElement(explicitStarts[0]);
                $('.simulation-hint').empty();
            });

            closerAction = () => { simHandler.stop(); };
        }


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

        return closerAction;
    }
);

export { visualizerModule };