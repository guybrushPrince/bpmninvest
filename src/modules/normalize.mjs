"use strict";
/**
 * The normalizer creates a more easy to handle process model out of valid BPMN model. This includes:
 * 1. Normalize starts when there are multiple ones.
 * 2. Normalize ends when there are multiple ones.
 * 3. Normalize starts and ends if they got incoming or outgoing flows, respectively, during normalization.
 * 4. Normalize gateways when they have multiple incoming and multiple outgoing flows.
 * 5. Normalize tasks when they have multiple incoming or multiple outgoing flows.
 * 6. Add tasks between directly connected gateways.
 */
import { StandardFaultType as FaultType } from "./stfaulttypes.mjs";
import { faultBus  } from "./faultbus.mjs";
import {BPMNModel, Process, Start, End, Gateway, GatewayType, Edge, Task, VirtualTask, LoopProcess} from "./model.mjs";
import {asList, asObject, diff, intersect, isEmpty, union} from "./settools.mjs";
import {flatten} from "array-flatten";
import {PathFinderFactory} from "./pathfinder.mjs";

/**
 * Normalizes a process model out of a BPMN model.
 * @type {NormalizerFactory}
 */
const Normalizer = (function () {

    /**
     * The constructor of NormalizerFactory.
     * @constructor
     */
    function NormalizerFactory() {
        let elementId = 1;

        /**
         * Normalize a set of process models contained in a set of BPMN models.
         * @param bpmn The BPMN model(s) to normalize.
         * @param withFaults If faults shall be shown.
         * @returns {*[]}
         */
        this.normalize = function (bpmn, withFaults = true) {
            if (!Array.isArray(bpmn)) bpmn = [ bpmn ];
            bpmn.forEach((bpmn) => {
                if (bpmn instanceof BPMNModel) {
                    // For all process models in the BPMN model ...
                    let all = bpmn.getProcesses.reduce((all, p) => {
                        // ... compute sets of incoming and outgoing flows.
                        p.computeInOut();
                        // Find the connected components within the model.
                        let connected = findConnectedComponents(p);
                        // Normalize each of the components.
                        connected.forEach((p) => this.normalizeProcess(p, withFaults));
                        all = all.concat(connected);
                        return all;
                    }, []);
                    bpmn.setProcesses(all);
                }
            });
            return bpmn;
        };

        /**
         * Normalize a process model (multiple start and end events, malformed gateways, etc.).
         * @param process The process model to normalize.
         * @param withFaults If faults shall be shown.
         */
        this.normalizeProcess = function (process, withFaults = true) {
            if (process instanceof Process) {
                if (!withFaults && asList(process.getNodes).length === 0) return;
                normalizeSingletonProcess(process);
                process.computeInOut();
                normalizeBoundaryEvents(process);
                process.computeInOut();
                normalizeStarts(process, withFaults);
                process.isValid();
                process.computeInOut();
                normalizeEnds(process, withFaults);
                process.isValid();
                process.computeInOut();
                normalizeStartAndEnds(process);
                process.isValid();
                normalizeGateways(process, withFaults);
                process.isValid();
                process.computeInOut();
                normalizeTasks(process);
                process.isValid();
                process.computeInOut();
                normalizeFlows(process);
                process.isValid();
                process.computeInOut();
            }
        };

        /**
         * Detect connected components in the case that the process model is not connected.
         * @param process The process model to find the connected components of.
         * @returns {*[]}
         */
        let findConnectedComponents = function (process) {
            let components = [];
            let nodes = union({}, process.getNodes);
            if (asList(nodes).length === 0) return [ process ];
            // We iterate over the list of nodes and eliminate nodes that are already in an identified component.
            while (asList(nodes).length > 0) {
                // Take the first one ...
                let first = asList(nodes).shift();
                // ... create a new component and ...
                let component = {};
                // ... and add this node to the nodes *next* to visit.
                let next = {};
                next[first.getId] = first;
                // Perform a depth-first search in all directions.
                do {
                    // Take the first of the next ...
                    let cur = asList(next).shift();
                    // ... and delete it from the list of next and of the list of nodes.
                    delete next[cur.getId];
                    delete nodes[cur.getId];
                    // Add it to the current component.
                    component[cur.getId] = cur;
                    // Add all preceding and succeeding nodes to next that are still in the *nodes* list.
                    next = union(next, intersect(union(cur.getPreset, cur.getPostset), nodes));
                } while (asList(next).length > 0);
                // If there is just a single component, then we have a connected model.
                if (components.length === 0 && asList(process.getNodes).length === asList(component).length) {
                    // Everything is fine (the graph is connected).
                    return [ process ];
                } else {
                    // Otherwise, create a new process model out of the component.
                    let p = new Process(process.getId + '_' + components.length);
                    p.setNodes(component);
                    p.setUI(process.getUI);
                    p.addElementId(process.elementIds);
                    p.setEdges(asList(process.getEdges).reduce((ed, e) => {
                        if (e.getSource.getId in component && e.getTarget.getId in component) {
                            ed[e.getId] = e;
                        }
                        return ed;
                    }, {}));
                    components.push(p);
                }
                // Perform next steps if the list of *nodes* is not empty.
            }
            return components;
        }

        /**
         * Normalize a process model just consisting of a single node. This is done by
         * adding an explicit start or end.
         * @param process The process model to normalize.
         */
        let normalizeSingletonProcess = function (process) {
            // If there is a process model with just a single node ...
            if (asList(process.getNodes).length === 1) {
                // ... add one to have a process with start and end.
                let newNode;
                let newEdge;
                let single = asList(process.getNodes)[0];
                // There is an end event, so add an explicit new start.
                if (single instanceof End) {
                    newNode = new Start('n' + elementId++, 'StartEvent');
                    newEdge = new Edge('n' + elementId++, newNode, single);
                } else { // There is any kind of node, so add an explicit new end event.
                    newNode = new End('n' + elementId++, 'EndEvent');
                    newEdge = new Edge('n' + elementId++, single, newNode);
                }
                newNode.setUI(single.getUI);
                newNode.addElementId(single.elementIds);
                process.addNode(newNode);
                newEdge.setUI(single.getUI);
                newEdge.addElementId(single.elementIds);
                process.addEdge(newEdge);
            }
        }

        /**
         * Normalize boundary events so that they are explicitly modeled through the control-flow (e.g.,
         * an interrupting boundary event is modeled by an XOR-split).
         * @param process The process model to normalize.
         */
        let normalizeBoundaryEvents = function (process) {
            // Boundary events on tasks / sub-processes are handled by transforming them into an explicit gateway.
            let withBoundaryEvents = asList(process.getNodes).filter(n =>
                n instanceof Task && asList(n.getBoundaries).length >= 1);
            withBoundaryEvents.forEach(n => {
                let boundaryEvents = n.getBoundaries;
                // It depends on whether there is a non-interrupting boundary event or not if we require an
                // exclusive or inclusive gateway to model its behavior.
                let nonInterrupting = asList(boundaryEvents).filter(b => !b.isInterrupting);
                let gatewayKind = GatewayType.XOR;
                if (nonInterrupting.length >= 1) {
                    // We require an inclusive gateway.
                    gatewayKind = GatewayType.OR;
                    // Add a warning to the non-interrupting boundary events.
                    /*faultBus.addInfo(process, {
                        task: n,
                        boundaries: nonInterrupting
                    }, FaultType.NON_INTERRUPTING);*/
                    isOnPathFromStartToEnd(process, boundaryEvents, n);
                }
                let gateway = new Gateway('n' + elementId++, null, gatewayKind);
                gateway.setUI(asList(boundaryEvents).map(b => b.getUI));
                gateway.addElementId(asList(boundaryEvents).map(b => b.elementIds));
                gateway.setImplicit(true);
                process.addNode(gateway);

                // Following p. 151 of the BPMN spec, an activity with multiple outgoing flows
                // will place a token on all its outgoing flows. We model this explicitly with an
                // AND gateway.
                // For this reason, we have to normalize the task first.
                if (asList(n.getOutgoing).length >= 2) {
                    // Add a parallel gateway after the task.
                    let g = new Gateway('n' + elementId++, null, GatewayType.AND);
                    g.setImplicit(true);
                    g.setUI(n.getUI);
                    g.addElementId(n.elementIds);
                    process.addNode(g);
                    asList(n.getOutgoing).forEach(function (e) {
                        e.setSource(g);
                    });
                    // Add an edge to the splitting gateway for parallel outgoing flows.
                    let edge = new Edge('n' + elementId++, gateway, g);
                    edge.setUI(n.getUI);
                    edge.addElementId(n.elementIds);
                    process.addEdge(edge);

                    // Now, this gateway is the "new" n.
                    n = g;
                } else {
                    // Redirect the edges to start from the new boundary gateway.
                    asList(n.getOutgoing).forEach(function (e) {
                        e.setSource(gateway);
                    });
                }
                // Add an edge to the new gateway for the boundary events.
                let edge = new Edge('n' + elementId++, n, gateway);
                edge.setUI(n.getUI);
                edge.addElementId(n.elementIds);
                process.addEdge(edge);
                // Add an edge from the new boundary gateway to the event(s).
                asList(boundaryEvents).forEach(b => {
                    let edge = new Edge('n' + elementId++, gateway, b);
                    edge.setUI(b.getUI);
                    edge.addElementId(b.elementIds);
                    process.addEdge(edge);
                });
            });
        }

        /**
         * Checks if a set of non-interrupting boundary events is merged back into the main
         * control-flow.
         * @param process The process containing the boundary events.
         * @param boundaries The non-interrupting boundary events.
         * @param task The task having those event.
         */
        let isOnPathFromStartToEnd = function (process, boundaries, task) {
            // Determine all nodes between start and ends without passing the current boundary event.
            let shallNotReach = {};
            let next = asObject(process.getStarts);
            do {
                next = asList(next);
                let cur =  next.shift();
                shallNotReach[cur.getId] = cur;
                next = union(asObject(next), diff(cur.getPostset, shallNotReach));
                if (cur instanceof Task && asList(cur.getBoundaries).length >= 1) {
                    let boundaryEvents = cur.getBoundaries;
                    next = union(next, asObject(asList(boundaryEvents).filter(b => !(b.getId in boundaries))));
                }
            } while (!isEmpty(next));

            // Now, starting from the non-interrupting event, is there any path to a node, which shall not be reached?
            let parents = {};
            next = asList(boundaries).reduce((n,b) => {
                n = union(n, b.getPostset);
                return n;
            }, {});
            let reaches = {};
            do {
                next = asList(next);
                let cur =  next.shift();
                reaches[cur.getId] = cur;
                if (!(cur.getId in shallNotReach)) {
                    next = union(asObject(next), diff(cur.getPostset, reaches));
                    if (cur instanceof Task && asList(cur.getBoundaries).length >= 1) {
                        next = union(next, cur.getBoundaries);
                        asList(cur.getBoundaries).forEach((b) => {
                            parents[b.getId] = cur.getId;
                        });
                    }
                }
            } while (!isEmpty(next));

            // If the non-interrupting is merged back to the main flow, we have a problem.
            let bad = intersect(reaches, shallNotReach);
            if (!isEmpty(bad)) {
                // We go back from those nodes to the boundary event for diagnostics.
                let paths = {};
                let badBoundary = {};
                next = union({}, bad);
                do {
                    next = asList(next);
                    let cur =  next.shift();
                    if (cur.getId in reaches) {
                        paths[cur.getId] = cur;
                        next = union(asObject(next), diff(cur.getPreset, paths));
                        if (cur.getId in parents) {
                            next = union(next, diff(asObject([ parent[cur.getId ]]), paths));
                        }
                    } else if (cur.getId in boundaries) {
                        paths[cur.getId] = cur;
                        badBoundary[cur.getId] = cur;
                    }
                } while (!isEmpty(next));

                // Inform about the error.
                faultBus.addWarning(process, {
                    task: task,
                    boundaries: badBoundary,
                    paths: paths
                }, FaultType.NON_INTERRUPTING_BACK);
            }
        };

        /**
         * Normalize starts, i.e., all explicit starts get a preceding XOR-split and all implicit starts get a
         * preceding AND-split and a single start event following the BPMN spec.
         * @param process The current process model.
         * @param withFaults If faults shall be shown.
         */
        let normalizeStarts = function (process, withFaults = true) {
            // Detect implicit and explicit start nodes
            let starts = asList(process.getNodes).filter((n) => asList(n.getIncoming).length === 0);

            // If there is no start, we do not know where to start.
            if (starts.length === 0 && withFaults) {
                faultBus.addError(process, [], FaultType.NO_START);
                return;
            }

            // Separate the starts into explicit and implicit starts.
            let explicitStarts = starts.filter((n) => (n instanceof Start));
            let implicitStarts = starts.filter((n) => !(n instanceof Start));

            // Send a warning if there is an implicit start.
            if (withFaults) {
                implicitStarts.forEach((n) => faultBus.addInfo(process, {
                    implicitStart: [ n ],
                    simulation: {
                        starts: explicitStarts
                    }
                }, FaultType.IMPLICIT_START));
            }

            // By the BPMN spec, start events are mutually explicit.
            // Implicit starts, however, get always parallel to a start events a token.
            // Therefore, we combine the explicit with a single XOR.
            // Then, we combine the implicit + the XOR with a single AND.
            let xor = null;
            if (explicitStarts.length > 0) {
                xor = explicitStarts[0];
                if (explicitStarts.length >= 2) {
                    xor = new Gateway('n' + elementId++, null, GatewayType.XOR);
                    xor.setImplicit(true);
                    xor.setUI(explicitStarts.map((s) => s.getUI));
                    xor.addElementId(flatten(explicitStarts.map((s) => s.elementIds)));
                    process.addNode(xor);
                    explicitStarts.forEach(function (start) {
                        let sf = new Edge('n' + elementId++, xor, start);
                        sf.setUI(start.getUI);
                        sf.addElementId(start.elementIds);
                        process.addEdge(sf);
                    });
                }
            }
            let and = xor;
            if (implicitStarts.length > 0) {
                if (xor !== null || implicitStarts.length >= 2) {
                    and = new Gateway('n' + elementId++, null, GatewayType.AND);
                    and.setImplicit(true);
                    and.setUI(implicitStarts.map((s) => s.getUI));
                    and.setDivergingStart(true);
                    and.addElementId(flatten(implicitStarts.map((s) => s.elementIds)));
                    process.addNode(and);
                    implicitStarts.forEach(function (start) {
                        let edge = new Edge('n' + elementId++, and, start);
                        edge.setUI(start.getUI);
                        edge.addElementId(start.elementIds);
                        process.addEdge(edge);
                    });
                    if (xor !== null) {
                        and.getUI.push(xor.getUI);
                        and.getUI.flat();
                        and.addElementId(xor.elementIds);
                        let edge = new Edge('n' + elementId++, and, xor);
                        edge.setUI(and.getUI);
                        edge.addElementId(and.elementIds);
                        process.addEdge(edge);
                    }
                } else {
                    and = implicitStarts[0];
                }
            }
            // If an AND-split was created, then an explicit start event is required.
            if (!(and instanceof Start) || asList(and.getOutgoing).length >= 2) {
                let start = new Start('n' + elementId++, 'StartEvent');
                start.setUI(and.getUI);
                start.addElementId(and.elementIds);
                process.addNode(start);
                let edge = new Edge('n' + elementId++, start, and);
                edge.setUI(start.getUI);
                edge.addElementId(start.elementIds);
                process.addEdge(edge);
            }

            // Replace each explicit start with multiple outgoing flows with an AND gateway.
            explicitStarts.forEach(function (start) {
                if (asList(start.getOutgoing).length >= 2) {
                    let nStart = new Gateway(start.getId, null, GatewayType.AND);
                    nStart.setImplicit(true);
                    faultBus.addInfo(process, start, FaultType.NON_GATEWAY_MULTIPLE_OUT);
                    nStart.setUI(start.getUI);
                    nStart.addElementId(start.elementIds);
                    process.replaceNode(start, nStart, false);
                }
            });
        };

        /**
         * Normalize ends, i.e., if there are multiple ends, they are all joined with an OR-join to simplify ongoing
         * analysis.
         * @param process The process model to normalize.
         * @param withFaults If faults shall be shown.
         */
        let normalizeEnds = function (process, withFaults = true) {
            // Detect implicit and explicit end nodes
            let ends =
                asList(process.getNodes).filter((n) => asList(n.getOutgoing).length === 0);

            // If there is no end node, we have a livelock and do not know where to end.
            if (ends.length === 0 && withFaults) {
                faultBus.addError(process, [], FaultType.NO_END);
                return;
            }

            // Filter the implicit ends and give a hint that the developer used one.
            let implicitEnds = ends.filter((n) => !(n instanceof End));
            if (withFaults) {
                implicitEnds.forEach((n) => faultBus.addInfo(process, {
                    implicitEnd: [ n ],
                    simulation: {
                        path: PathFinderFactory().findPathFromStartToTarget(n, process)
                    }
                }, FaultType.IMPLICIT_END));
            }

            // By the BPMN spec, p. 248, a process is in a running state until all tokens are consumed.
            // If an end event has multiple incoming flows, then they can be inclusive.
            // For this reason, we can insert an OR-join to combine all end events.

            let or = null;
            if (ends.length >= 2) {
                // Insert an OR/XOR-join to join all ends.
                or = new Gateway('n' + elementId++, null, (withFaults ? GatewayType.OR : GatewayType.XOR));
                or.setImplicit(true);
                or.setUI(ends.map((e) => e.getUI));
                or.addElementId(flatten(ends.map((e) => e.elementIds)));
                if (!withFaults && process instanceof LoopProcess) or.setConvergingEnd(true);
                process.addNode(or);
                ends.forEach(function (end) {
                    if (end instanceof End && asList(end.getIncoming).length >= 2) {
                        // If an end event has multiple incoming flows, make the joining behavior explicit.
                        let nEnd = new Gateway(end.getId, null, GatewayType.OR);
                        nEnd.setImplicit(true);
                        nEnd.setUI(end.getUI);
                        nEnd.addElementId(end.elementIds);
                        process.replaceNode(end, nEnd, false);
                        end = nEnd;
                    }
                    // Add an edge between the end and the OR/XOR gateway..
                    let sf = new Edge('n' + elementId++, end, or);
                    sf.addElementId(union(end.elementIds, or.elementIds));
                    sf.setUI(end.getUI);
                    process.addEdge(sf);
                });
            }
            if (or === null) {
                let end = ends[0];
                // If the single end event has multiple incoming flows, make its joining behavior explicit.
                if (end instanceof End && asList(end.getIncoming).length >= 2) {
                    let nEnd = new Gateway(end.getId, null, GatewayType.OR);
                    nEnd.setImplicit(true);
                    nEnd.setUI(end.getUI);
                    nEnd.addElementId(end.elementIds);
                    process.replaceNode(end, nEnd, false);
                    or = nEnd;
                }
            }

            if (or !== null) {
                // Finally insert an explicit end event succeeding the OR/XOR-join.
                let end = new End('n' + elementId++, 'EndEvent');
                end.setUI(or.getUI);
                end.addElementId(or.elementIds);
                process.addNode(end);
                // Add an edge between the OR/XOR-join and the new explicit end.
                let edge = new Edge('n' + elementId++, or, end);
                edge.setUI(end.getUI);
                edge.addElementId(end.elementIds);
                process.addEdge(edge);
            } else if (ends.length === 1 && implicitEnds.length === 1) {
                // If there was just a single (implicit) end, insert an explicit end event.
                let end = new End('n' + elementId++, 'EndEvent');
                end.setUI(ends[0].getUI);
                end.addElementId(ends[0].elementIds);
                process.addNode(end);
                // Add an edge between the single implicit end and the new explicit end.
                let edge = new Edge('n' + elementId++, ends[0], end);
                edge.setUI(end.getUI);
                edge.addElementId(end.elementIds);
                process.addEdge(edge);
            }
        };

        /**
         * During normalizing starts and ends, some starts and ends got preceding or succeeding nodes. They have
         * to be replaced with tasks.
         * @param process The process model to normalize.
         */
        let normalizeStartAndEnds = function (process) {
            let startEnds = asList(process.getNodes).filter((n) => (n instanceof Start || n instanceof End));
            startEnds.forEach(function (s) {
                if ((s instanceof Start && asList(s.getIncoming).length >= 1) ||
                    (s instanceof End && asList(s.getOutgoing).length >= 1)) {
                    // Create a new task for the start ...
                    let nS = new Task(s.getId, s.className);
                    nS.setUI(s.getUI);
                    nS.addElementId(s.elementIds);
                    // ... and replace the node.
                    process.replaceNode(s, nS, false);
                    nS.setIncoming(s.getIncoming);
                    nS.setOutgoing(s.getOutgoing);
                }
            });
        }

        /**
         * Normalize gateways, which are malformed (e.g., multiple incoming and multiple outgoing flows at the same
         * time). Gateways with multiple incoming and multiple outgoing flows are separated into two gateways:
         * one converging and one diverging.
         * @param process The process model to normalize.
         * @param withFaults If faults shall be shown.
         */
        let normalizeGateways = function (process, withFaults = true) {
            let gateways = asList(process.getNodes).filter((n) => (n instanceof Gateway));
            gateways.forEach(function (g) {
                // Check if the gateway is converging and diverging at the same time.
                if (asList(g.getOutgoing).length >= 2 && asList(g.getIncoming).length >= 2) {
                    // Split the gateway into two.
                    let n = new Gateway('n' + elementId++, null, g.getKind);
                    n.setUI(g.getUI);
                    n.addElementId(g.elementIds);
                    process.addNode(n);
                    // Redirect the outgoing edges to start from the new diverging gateway.
                    asList(g.getOutgoing).forEach(function (e) {
                        e.setSource(n);
                    });
                    // Add an edge between the old gateway and the new diverging gateway.
                    let edge = new Edge('n' + elementId++, g, n);
                    edge.setUI(g.getUI);
                    edge.addElementId(g.elementIds);
                    process.addEdge(edge);
                }
                // Check if the gateway is malformed.
                if (asList(g.getOutgoing).length <= 1 && asList(g.getIncoming).length <= 1 ||
                    asList(g.getOutgoing).length >= 2 && asList(g.getIncoming).length >= 2) {
                    if (withFaults) faultBus.addWarning(process, {
                        gateway: g,
                        incoming: asList(g.getIncoming).length,
                        outgoing: asList(g.getOutgoing).length
                    }, FaultType.GATEWAY_WITHOUT_MULTIPLE_FLOWS);
                }
            });
        };

        /**
         * Normalize tasks that have multiple incoming or multiple outgoing flows.
         * @param process The process model to normalize.
         */
        let normalizeTasks = function (process) {
            let tasks = asList(process.getNodes).filter((n) => (n instanceof Task));
            tasks.forEach(function (t) {
                // Following p. 151 of the BPMN spec, an activity with multiple incoming flows
                // will always be instantiated when a token is on an incoming flow. I.e., if there
                // are two incoming flows with a token of each of them, the activity is executed twice.
                // We model that with an XOR gateway.
                if (asList(t.getIncoming).length >= 2) {
                    // Inform about the error.
                    faultBus.addInfo(process, t, FaultType.NON_GATEWAY_MULTIPLE_IN);

                    // Create a new XOR-join.
                    let g = new Gateway('n' + elementId++, null, GatewayType.XOR);
                    g.setImplicit(true);
                    g.setUI(t.getUI);
                    g.addElementId(t.elementIds);
                    process.addNode(g);
                    // Redirect the flow to the new XOR-join.
                    asList(t.getIncoming).forEach(function (e) {
                        e.setTarget(g);
                    });
                    // Add an edge between the new XOR-join and the task.
                    let edge = new Edge('n' + elementId++, g, t);
                    edge.setUI(g.getUI);
                    edge.addElementId(g.elementIds);
                    process.addEdge(edge);
                }
                // Following p. 151 of the BPMN spec, an activity with multiple outgoing flows
                // will place a token on all its outgoing flows. We model this explicitly with an
                // AND gateway.
                if (asList(t.getOutgoing).length >= 2) {
                    faultBus.addInfo(process, t, FaultType.NON_GATEWAY_MULTIPLE_OUT);

                    // Create a new AND-split diverging the outgoing flows in parallel.
                    let g = new Gateway('n' + elementId++, null, GatewayType.AND);
                    g.setImplicit(true);
                    g.setUI(t.getUI);
                    g.addElementId(t.elementIds);
                    process.addNode(g);
                    // Redirect the outgoing flows.
                    asList(t.getOutgoing).forEach(function (e) {
                        e.setSource(g);
                    });
                    // Add an edge between the task and the new AND-split.
                    let edge = new Edge('n' + elementId++, t, g);
                    edge.setUI(t.getUI);
                    edge.addElementId(t.elementIds);
                    process.addEdge(edge);
                }
            });
        };

        /**
         * Normalize flows if they connect two gateways directly. In such a case, a new silent (virtual) task is
         * inserted between to simplify analysis.
         * @param process The process model to normalize.
         */
        let normalizeFlows = function (process) {
            let gateways = asList(process.getNodes).filter(n => n instanceof Gateway);
            gateways.forEach(function (g) {
                asList(g.getOutgoing).forEach(e => {
                    let s = e.getTarget;
                    if (s instanceof Gateway) {
                        // There are two gateways with a direct edge between them.
                        // We add a silent (virtual) task in between them to simplify analysis.
                        let t = new VirtualTask('n' + elementId++);
                        t.setUI(e.getUI);
                        t.addElementId(e.elementIds);
                        process.addNode(t);
                        // Redirect the "old" edge to the new task.
                        e.setTarget(t);
                        // Insert a new edge between the new task and the target gateway.
                        let edge = new Edge('n' + elementId++, t, s);
                        edge.setUI(e.getUI);
                        edge.addElementId(e.elementIds);
                        process.addEdge(edge);
                    }
                });
            });
        };
    }

    return new NormalizerFactory();
})();

export { Normalizer };