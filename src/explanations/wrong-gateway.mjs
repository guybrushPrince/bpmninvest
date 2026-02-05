import { VisualizerModule } from "../modules/vismodule.mjs";
import { StandardFaultType as FaultType } from "../modules/stfaulttypes.mjs";
import { FaultLevel } from "../modules/faultbus.mjs";
import { PathFinderFactory } from "../modules/pathfinder.mjs";
import { asList, asObject } from "../modules/settools.mjs";
import {FaultKind} from "../modules/faultkind.mjs";

const GATEWAY_WITHOUT_MULTIPLE_FLOWS = 'Wrongly structured gateway';

let visualizerModule = new VisualizerModule(
    FaultType.GATEWAY_WITHOUT_MULTIPLE_FLOWS,
    FaultLevel.WARNING,
    function (type, process, information, visualizer, modeler) {
        let element = information.gateway;
        let ui = element.getUI$;
        visualizer.addWarningLine(ui);
        visualizer.addOverlay(ui, type, GATEWAY_WITHOUT_MULTIPLE_FLOWS, (panel) => {
            visualizer.setFocus(null, ui);

            this.getExplanation(panel, type, information, modeler, visualizer);
        });
    },
    function (panel, fType, information, modeler, visualizer) {
        let defectGateway = information.gateway;

        panel.append('<h1>Process Model has a Wrongly Structured Gateway</h1>');
        visualizer.appendFaultKind(panel, { type: fType, kind: FaultKind.NO_BEST_PRACTICE });

        panel.append('<h2>Explanation</h2>');
        panel.append('<p>Following the BPMN 2.0.2 specification, a <em>gateway</em> shall diverge or converge ' +
            'control flows, either to perform decisions or describe concurrent workflows (or a mix of both). ' +
            'As a best practice, a gateway shall either have exactly one single incoming flow and at least two outgoing ' +
            'sequence flows (in case of a diverging gateway) or at least two incoming flows and exactly one single ' +
            'outgoing sequence flow (in case of a converging gateway). Gateways without an incoming or outgoing flow as ' +
            'well as gateways with a single ' +
            'incoming and a single outgoing flow are arbitrary and increase the difficulty to understand the process ' +
            'model.</p>');

        let inFlows = information.incoming;
        let outFlows = information.outgoing;

        let textIn = 'one incoming flow';
        if (inFlows === 0) textIn = 'no incoming flow';
        if (inFlows >= 2) textIn = inFlows + ' incoming flows';

        let textOut = 'one outgoing flow';
        if (outFlows === 0) textOut = 'no outgoing flow';
        if (outFlows >= 2) textOut = inFlows + ' outgoing flows';

        let link = visualizer.getElementLink(defectGateway);

        panel.append('<h2>Flaw in your process model</h2>');
        panel.append('<p>Your process model contains the yellow highlighted ' + link + ' that you ' +
            'have modelled with ' + textIn + ' and ' + textOut + '.</p>');
        if (inFlows === 0) {
            panel.append('<p>The ' + link + ' misses an incoming flow.</p>');
        } else if (inFlows >= 2) {
            panel.append('<p>The ' + link + ' is both at the same time: a converging and diverging gateway.</p>');
        }
        if (outFlows === 0) {
            panel.append('<p>The ' + link + ' misses an outgoing flow.</p>');
        }
        if (inFlows === 1 && outFlows === 1) {
            panel.append('<p>The ' + link + ' is arbitrary and does not have any effect in your process model.</p>');
        }


        panel.append('<h2>Repair suggestions</h2>');
        if (inFlows === 0) {
            panel.append('<p>Please insert an incoming flow to your ' + link + ', e.g., from another element.</p>');
        } else if (inFlows >= 2) {
            panel.append('<p>Separate the ' + link + ' into two gateways: One converges the flows and one diverges ' +
                'the flows.</p>');
        }
        if (outFlows === 0) {
            panel.append('<p>Please insert an outgoing flow to your ' + link + ', e.g., to another element.</p>');
        }
        if (inFlows === 1 && outFlows === 1) {
            panel.append('<p>Replace the ' + link + ' with a simple sequence flow or add an incoming flow from or an' +
                ' outgoing flow to another element.' + '</p>');
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
    }
);

export { visualizerModule };