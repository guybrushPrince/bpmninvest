import { VisualizerModule } from "../modules/vismodule.mjs";
import { StandardFaultType as FaultType } from "../modules/stfaulttypes.mjs";
import { FaultLevel } from "../modules/faultbus.mjs";
import { union } from "../modules/settools.mjs";
import {FaultKind} from "../modules/faultkind.mjs";

const NON_GATEWAY_MULTIPLE_OUT = 'Multiple outgoing flows';

let visualizerModule = new VisualizerModule(
    FaultType.NON_GATEWAY_MULTIPLE_OUT,
    FaultLevel.INFO,
    function (type, process, elements, visualizer, modeler) {
        visualizer.addInfoLine(elements.getUI$);
        let closerAction = () => {};
        visualizer.addOverlay(elements.getUI$, type, NON_GATEWAY_MULTIPLE_OUT, (panel) => {
            let focus = union({}, elements.getOutgoing);
            focus[elements.getId] = elements;

            visualizer.setFocus(visualizer.mapModelToBPMNUI(focus), elements.getUI$);

            closerAction = this.getExplanation(panel, type, elements, visualizer);
        }, () => { closerAction(); });
    },
    function (panel, fType, information, visualizer) {
        panel.append('<h1>Non-Gateway with Multiple Outgoing Sequence Flows</h1>');
        visualizer.appendFaultKind(panel, { type: fType, kind: FaultKind.NO_BEST_PRACTICE });

        panel.append('<h2>Explanation</h2>');
        panel.append('<p>Following the BPMN 2.0.2 specification, <em>tasks</em>, <em>intermediate events</em>, etc. ' +
            'can have more than one outgoing <em>sequence flow</em>s. ' +
            'After executing such elements, each outgoing <em>sequence flow</em> is followed by a token. ' +
            'Thus, the element behaves like a parallel (AND) gateway.</p>' +
            '<p>As a best practice, only <em>gateways</em> should have multiple outgoing <em>sequence flow</em>s. ' +
            'Otherwise, the process model becomes more difficult to read and to understand. ' +
            'Although not a problem during automation, we recommend to make the diverging parallel behavior ' +
            'obvious with a <em>gateway</em>.</p>');

        let link = visualizer.getElementLink(information);

        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>Please insert a parallel (AND) gateway after your ' + link + ' and redirect the ' +
            'outgoing sequence flows to start in this newly inserted gateway. Subsequent add a new sequence flow from ' +
            'your ' + link + ' to this new gateway.</p>');

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