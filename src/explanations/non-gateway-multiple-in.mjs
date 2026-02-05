import { VisualizerModule } from "../modules/vismodule.mjs";
import { StandardFaultType as FaultType } from "../modules/stfaulttypes.mjs";
import { FaultLevel } from "../modules/faultbus.mjs";
import {FaultKind} from "../modules/faultkind.mjs";

const NON_GATEWAY_MULTIPLE_IN = 'Multiple incoming flows';

let visualizerModule = new VisualizerModule(
    FaultType.NON_GATEWAY_MULTIPLE_IN,
    FaultLevel.INFO,
    function (type, process, elements, visualizer, modeler) {
        visualizer.addInfoLine(elements.getUI$);
        let closerAction = () => {};
        visualizer.addOverlay(elements.getUI$, type, NON_GATEWAY_MULTIPLE_IN, (panel) => {
            visualizer.setFocus(visualizer.mapModelToBPMNUI(elements.getIncoming), elements.getUI$);

            closerAction = this.getExplanation(panel, type, elements, visualizer);
        }, () => { closerAction(); });
    },
    function (panel, fType, information, visualizer) {
        panel.append('<h1>Non-Gateway with Multiple Incoming Sequence Flows</h1>');
        visualizer.appendFaultKind(panel, { type: fType, kind: FaultKind.NO_BEST_PRACTICE });

        panel.append('<h2>Explanation</h2>');
        panel.append('<p>Following the BPMN 2.0.2 specification, <em>tasks</em>, <em>intermediate events</em>, etc. ' +
            'can have more than one incoming <em>sequence flow</em>s. ' +
            'In such cases, each token on an incoming flows will start the <em>task</em>, <em>event</em>, etc. ' +
            'Thus, the element behaves like an exclusive (XOR) gateway.</p>' +
            '<p>As a best practice, only <em>gateways</em> should have multiple incoming <em>sequence flow</em>s. ' +
            'Otherwise, the process model becomes more difficult to read and to understand. ' +
            'Although not a problem during automation, we recommend to make the converging exclusive behavior ' +
            'obvious with a <em>gateway</em>.</p>');

        let link = visualizer.getElementLink(information);

        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>Please insert an exclusive (XOR) gateway in front of your ' + link + ' and redirect the ' +
            'incoming sequence flows to this newly inserted gateway. Subsequent add a new sequence flow from this ' +
            'new gateway to your ' + link + '.</p>');

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