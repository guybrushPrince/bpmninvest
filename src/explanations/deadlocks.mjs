import $ from 'jquery';
import { asList, asObject } from "../modules/settools.mjs";
import { TokenSimulationHandling } from "../modules/simsupport.mjs";
import { flatten } from "array-flatten";
import { PathFinderFactory } from "../modules/pathfinder.mjs";
import { VisualizerModule } from "../modules/vismodule.mjs";
import { FaultLevel, FaultType } from "../modules/faultbus.mjs";

const POTENTIAL_DEADLOCK = 'Possible deadlock';

let visualizerModule = new VisualizerModule(
    FaultType.POTENTIAL_DEADLOCK,
    FaultLevel.ERROR,
    function (type, process, elements, visualizer, modeler) {
        let join = elements.join;
        let paths = elements.paths;
        visualizer.addErrorLine(join.getUI$);
        let closerAction = () => {};
        visualizer.addOverlay(join.getUI$, type, POTENTIAL_DEADLOCK, (panel) => {
            let flawsUI = [];
            if (asList(elements.flaws).length > 0) {
                asList(elements.flaws).forEach((flaws) => {
                    flawsUI = flawsUI.concat(visualizer.mapModelToBPMNUI(flaws));
                });
            }
            let pathsUI = flatten(asList(paths).map(p => visualizer.mapModelToBPMNUI(p)));
            visualizer.setFocus(flawsUI, pathsUI);

            closerAction = this.getExplanation(panel, elements, modeler);
        }, () => { closerAction(); });
    },
    function (panel, information, modeler) {
        let join = information.join;
        let pathFinder = PathFinderFactory(modeler);
        let joinProcessElement = pathFinder.mapNodeSetToBPMN(asObject([ join ])).concat([]);
        joinProcessElement = joinProcessElement.shift();

        panel.append('<h1>Deadlock</h1>');

        panel.append('<h2>Explanation</h2>');
        panel.append('<p>A <em>deadlock</em> is a situation, in which a process model blocks (locally). ' +
            'Such a situation hinders the process model to terminate successfully. As a consequence, it may happen ' +
            'that such a process model leads to unexpected situations in practice (tasks that are not finished, objectives ' +
            'that are not reached, and so on).</p>');
        panel.append('<p>A best practice is that each process model should have the <strong>option to complete</strong>, ' +
            'a <strong>proper termination</strong>, and <strong>no dead tasks</strong>. All these best practices ' +
            'are violated by a deadlock.</p>');
        panel.append('<p>Research has shown that typical deadlocks occur in <em>diverging parallel gateways</em> or in ' +
            ' two or more <em>diverging inclusive gateways</em> waiting for the execution of each other. ' +
            'A deadlock in a diverging parallel gateway is caused if at least one but not all incoming sequence flows ' +
            'of the gateway get a token. Each diverging parallel gateway requires a (implicit) <em>triggering</em> converging ' +
            'parallel gateway on all paths to its incoming sequence flows, which guarantees the execution of the gateway ' +
            'when a control flow reaches one of its incoming flows. Otherwise, it is <em>not</em> guaranteed that the ' +
            'gateway is executed - it may block locally and causes a deadlock.' +
            '</p>');
        panel.append('<p>Once a deadlock occurs, it cannot be solved without external intervention. For this reason, ' +
            'it is desirable to avoid any deadlock situation in a process model.</p>');



        let type = joinProcessElement.type.substring(5);
        let joinLink = '<a data-element-link=\'' + JSON.stringify(asList(join.elementIds)) + '\'>' + type  + '</a>';
        let implicitExplicit = type.includes('Gateway') ? '' : 'n implicit';

        panel.append('<h2>Flaw in your process model</h2>');
        panel.append('<p>You have a' + implicitExplicit + ' converging parallel gateway ' + joinLink + ' in your ' +
            'process model. It is not guaranteed that it is executed once the execution reaches one of its incoming ' +
            'flows. The pulsating elements in your process model hinders a guaranteed execution of your ' +
            joinLink + ' since it could be decided that the execution takes a path ignoring your ' +
            joinLink + '.</p>');


        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>The pulsating elements hinder (maybe through decisions) whether your ' + joinLink + ' is ' +
            'executed or not. Is it possible to replace them with a diverging parallel gateway? Is your ' +
            joinLink + ' really necessary or do you have only mutually exclusive paths? Although not recommended, ' +
            'you could also repair your model by using an explicit converging inclusive gateway.</p>');


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
            'Thomas M. Prinz, Wolfram Amme:<br>' +
            '<a href="https://doi.org/10.7250/csimq.2021-27.01" target="_blank">Control-Flow-Based Methods to Support the Development of Sound Workflows.</a><br>' +
            'Complex Syst. Informatics Model. Q. 27: 1-44 (2021)' +
            '</blockquote>');
        panel.append('<blockquote>' +
            'C&#233;dric Favre, Hagen V&ouml;lzer:<br>' +
            '<a href="https://doi.org/10.1007/978-3-642-15618-2_19" target="_blank">Symbolic Execution of Acyclic Workflow Graphs.</a><br>' +
            'BPM 2010: 260-275' +
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

        let path = simInformation.path;
        simHandler.setDecisions(path);

        // Set decisions for each non-triggering gateway:
        let nonTriggers = simInformation.nonTriggers;
        flatten(asList(nonTriggers)).forEach(gF => {
            let gatewayId = gF.gateway;
            let flowsIds = gF.edges;
            simHandler.setSolvedDecision(gatewayId, flowsIds);
        });

        simButton.on('click', function () {
            simHandler.controlElement(path[0]);
            $('.simulation-hint').empty();
        });

        return () => { simHandler.stop(); };
    }
);

export { visualizerModule };