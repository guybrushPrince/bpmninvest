import { VisualizerModule } from "../modules/visualizer.mjs";
import { FaultType, FaultLevel } from "../modules/faultbus.mjs";
import $ from "jquery";

const NO_START = 'No explicit or implicit start event';

let visualizerModule = new VisualizerModule(
    FaultType.NO_START,
    FaultLevel.ERROR,
    function (type, process, elements, visualizer) {
        let ui = $(process.getUI$[0]);
        visualizer.addErrorLine(ui);
        visualizer.addOverlay(ui, type, NO_START, (panel) => {
            visualizer.setFocus(null, ui);

            this.getExplanation(panel);
        }, () => {}, true);
    }, function (panel) {
        panel.append('<h1>Process Model has no Start Event</h1>');

        panel.append('<h2>Explanation</h2>');
        panel.append('<p>Following the BPMN 2.0.2 specification, a BPMN process model requires at least one starting ' +
            'point. Such a starting point can be either an explicit <em>Start Event</em> or an implicit start ' +
            '(a node without incoming sequence flows). Such starting points define where your process model may start ' +
            'after instantiation.' + '</p>');

        panel.append('<h2>Flaw in your process model</h2>');
        panel.append('<p>Your process model does not contain any explicit or implicit starting point. For this ' +
            'reason, it cannot be successfully executed.</p>');

        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>Please re-investigate your process model to identify places where your process model shall ' +
            'start. On such places, you either insert a <em>Start Event</em> or another node without incoming ' +
            'sequence flows.' +
            '</p>');

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
    });

export { visualizerModule };