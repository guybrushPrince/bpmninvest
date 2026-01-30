import SimulationSupport, {
    ENTER_EVENT,
    EXIT_EVENT
} from "bpmn-js-token-simulation/lib/simulation-support/SimulationSupport.js";
import {asList, asObject, intersect, isEmpty, isObject} from "./settools.mjs";
import {
    Node,
    Edge,
    Gateway,
    GatewayType,
    Start,
    Task,
    End,
    LoopTask,
    LoopEntryGateway,
    LoopExitGateway, ProcessEvent
} from "./model.mjs";
import { PAUSE_SIMULATION_EVENT, TRACE_EVENT } from "bpmn-js-token-simulation/lib/util/EventHelper.js";
import {flatten} from "array-flatten";
import {getBusinessObject} from "bpmn-js/lib/util/ModelUtil";

let TokenSimulationHandling = function (modeler) {

    function TokenSimulator() {
        let simulationSupport = new SimulationSupport(modeler, modeler.get('toggleMode'));
        let simulator = modeler.get('simulator');
        let elementRegistry = modeler.get('elementRegistry');
        let eventBus = modeler.get('eventBus');
        let pauseSimulation = modeler.get('pauseSimulation');

        let controlledBoundaries = {};

        this.start = function () {
            eventBus.on(TRACE_EVENT, function(event) {
                if (event.action === 'enter') {
                    eventBus.fire(ENTER_EVENT, event);
                }
                if (event.action === 'exit') {
                    eventBus.fire(EXIT_EVENT, event);
                }
            });
            simulationSupport.toggleSimulation(true);
        };

        this.pause = function() {
            pauseSimulation.pause();
        };

        this.stop = function () {
            eventBus.off(TRACE_EVENT);
            simulationSupport.toggleSimulation(false);
        };

        this.setDecision = function (gateway, flow) {
            if (gateway instanceof Gateway && !isEmpty(gateway.elementIds)) {
                let gatewayId = asList(gateway.elementIds)[0];
                let isInclusive = gateway.getKind === GatewayType.OR;

                if (isObject(flow) && !(flow instanceof Edge)) flow = asList(flow);
                if (!Array.isArray(flow)) flow = [ flow ];
                flow = flow.map(f => {
                    if (!isEmpty(f.elementIds)) {
                        let fId = asList(f.elementIds)[0];
                        let el = elementRegistry.get(fId);
                        if (el === undefined) return null;
                        else return el;
                    } else return null;
                }).filter(f => f !== null);

                if (flow.length >= 1) {
                    if (!isInclusive) flow = flow.shift();
                    simulator.setConfig(gatewayId, { activeOutgoing: flow });
                }
            }
        };

        this.setSolvedDecision = function (gatewayIds, flowIds) {
            if (gatewayIds !== null && flowIds !== null) {
                gatewayIds.forEach(gatewayId => {
                    let el = elementRegistry.get(gatewayId);
                    if (el !== undefined) {
                        let flow = el.outgoing.filter(f => {
                            return flowIds.includes(f.id);
                        });
                        if (flow.length > 0) {
                            // We take the last flow since it is nearer to the target node.
                            simulator.setConfig(el, { activeOutgoing: flow.pop() });
                        }
                    }
                });
            }
        };

        this.setDecisions = function (path) {
            if (path === null || path === undefined) return;
            path.forEach(n => {
                let el = elementRegistry.get(n);
                if (el !== undefined) {
                    let flow = el.outgoing.filter(f => {
                        return path.includes(f.id);
                    });
                    if (flow.length > 0) {
                        // We take the last flow since it is nearer to the target node.
                        simulator.setConfig(el, { activeOutgoing: flow.pop() });
                    }
                    let businessObject = getBusinessObject(el);
                    if (businessObject && 'attachedToRef' in businessObject) {
                        let ref = businessObject.attachedToRef;
                        if (!(ref.id in controlledBoundaries)) {
                            // We only send the boundary event once.
                            this.controlElement(ref.id);
                            controlledBoundaries[ref.id] = ref;
                            let prom = simulationSupport.elementEnter(ref.id);
                            prom.then(() => {
                                this.controlElement(el.id);
                                this.controlElement(ref.id);
                            });
                        }
                    }
                }
            });
        };

        this.controlElement = function (node) {
            if (isObject(node) && !(node instanceof Node)) {
                node = asList(node);
            }
            if (!Array.isArray(node)) node = [ node ];
            node.forEach(n => {
                if ((n instanceof Gateway && n.getKind !== GatewayType.AND) ||
                    (n instanceof Task) || (n instanceof ProcessEvent) || (n instanceof Start) || (n instanceof End)) {
                    if (!isEmpty(n.elementIds)) {
                        let id = asList(n.elementIds)[0];
                        try {
                            simulationSupport.triggerElement(id);
                        } catch (exception) {
                            console.log(exception);
                        }
                    }
                } else if (typeof n === 'string') {
                    try {
                        simulationSupport.triggerElement(n);
                    } catch (exception) {
                        console.log(exception);
                    }
                }
            });
        };

        this.pauseIfExited = function (node, action = () => {}, pause = true) {
            if (isObject(node) && !(node instanceof Node)) {
                node = asList(node);
            }
            if (!Array.isArray(node)) node = [ node ];
            node.forEach(n => {
                if (!isEmpty(n.elementIds)) {
                    let id = asList(n.elementIds)[0];
                    let prom = simulationSupport.elementExit(id);
                    prom.then(() => {
                        if (pause) pauseSimulation.pause();
                        action(n);
                    });
                }
            });
        };
        this.pauseIfEntered = function (node, action = () => {}, pause = true) {
            if (isObject(node) && !(node instanceof Node)) {
                node = asList(node);
            }
            if (!Array.isArray(node)) node = [ node ];
            node.forEach(n => {
                if (!isEmpty(n.elementIds)) {
                    let id = asList(n.elementIds)[0];
                    let prom = simulationSupport.elementEnter(id);
                    prom.then(() => {
                        if (pause) pauseSimulation.pause();
                        action(n);
                    });
                }
            });
        }
    }

    return new TokenSimulator();

};

export { TokenSimulationHandling };