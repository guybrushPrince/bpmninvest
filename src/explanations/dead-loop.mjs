import { VisClasses, VisualizerModule } from "../modules/visualizer.mjs";
import { FaultType, FaultLevel } from "../modules/faultbus.mjs";
import { asList, union } from "../modules/settools.mjs";

const DEAD_LOOP = 'Dead loop';

let visualizerModule = new VisualizerModule(
    FaultType.DEAD_LOOP,
    FaultLevel.ERROR,
    function (type, process, elements, visualizer, modeler) {
        let loopModel = elements.loop;
        let loop = visualizer.mapToUI(union(loopModel.getNodes, loopModel.getEdges));
        visualizer.addClass(loop, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
        let representative = asList(loopModel.getNodes)[0];
        visualizer.addOverlay(representative.getUI$, type, DEAD_LOOP, (panel) => {
            visualizer.fadeOut();
            visualizer.addClass(loop, [VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE, VisClasses.NON_FADE],
                VisClasses.NON_FADE);

            this.getExplanation(panel, elements, modeler);
        }, () => { });
    },
    function (panel, information, modeler) {
        panel.append('<h1>Dead Loop</h1>');

        panel.append('<h2>Explanation</h2>');
        panel.append('<p><em>Loops</em> are cyclic structures in a process model, in which each node has a path to each ' +
            'other node of the loop (called <em>strongly connected component</em>, SCC). ' +
            'Usually, loops can be entered at some nodes, the <em>loop entries</em>. Therefore, loop entries are ' +
            '<em>gateways</em>. If a loop has <em>no loop entry</em>, it cannot be entered. For this reason, such a loop ' +
            'is called <em>dead</em>. Although it does not lead to unexpected behavior in process models, having dead ' +
            'loops in a process models is considered bad style.</p>');

        panel.append('<h2>Flaw in your process model</h2>');
        panel.append('<p>Your process model contains the red-pulsating highlighted loop that has no entry.</p>');

        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>Either consider to add an entry into the loop (e.g., by adding a gateway to the loop and connect ' +
            'a sequence flow to it from outside the loop) or remove the entire loop if it is not required.</p>');

        panel.append('<h2>References:</h2>');
        panel.append('<blockquote>' +
            'Thomas M. Prinz, Yongsun Choi, N. Long Ha:<br>' +
            '<a href="https://doi.org/10.1016/j.is.2024.102476" target="_blank">Soundness unknotted: An efficient soundness checking algorithm for arbitrary cyclic process models by loosening loops.</a><br>' +
            'Inf. Syst. 128: 102476 (2025)' +
            '</blockquote>');
        panel.append('<blockquote>' +
            'Marlon Dumas, Marcello La Rosa, Jan Mendling, Hajo A. Reijers<br>' +
            '<a href="https://doi.org/10.1007/978-3-662-56509-4" target="_blank">Fundamentals of Business Process Management.</a><br>' +
            'Second Edition. Springer 2018, ISBN 978-3-662-56508-7, pp. 181-187.' +
            '</blockquote>');
    }
);

export { visualizerModule };