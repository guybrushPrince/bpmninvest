import { asList, union, intersect, diff } from "./settools.mjs";
import {
    BPMNModel,
    Start,
    End,
    Gateway,
    GatewayType,
    LoopProcess,
    LoopTask,
    Edge,
    VirtualTask,
    LoopEntryGateway, LoopExitGateway
} from "./model.mjs";
import { Normalizer } from "./normalize.mjs";
import {flatten} from "array-flatten";

/**
 * Performs a loop decomposition of given process models and returns a set of acyclic process models where
 * acyclic process models resulting of loops are of type LoopProcess.
 *
 * The algorithms are based on:
 * Prinz, T. M., Choi, Y. & Ha, N. L. (2024).
 * Soundness unknotted: An efficient soundness checking algorithm for arbitrary cyclic process models by loosening loops.
 * DOI: https://doi.org/10.1016/j.is.2024.102476
 *
 * where the basic approach is described here:
 *
 * Thomas M. Prinz, Yongsun Choi, N. Long Ha (2024):
 * Understanding and Decomposing Control-Flow Loops in Business Process Models. BPM 2022: 307-323
 * DOI: https://doi.org/10.1007/978-3-031-16103-2_21
 */
const LoopDecomposition = (function () {

    let elementId = 0;

    function LoopDecompositionFactory() {

        let uniqueLoops = {};
        let acyclicProcesses = {};

        /**
         * Decompose a BPMN model.
         * @param bpmn
         * @returns {{}}
         */
        this.decompose = function (bpmn) {
            if (!Array.isArray(bpmn)) bpmn = [ bpmn ];
            bpmn.forEach((bpmn) => {
                if (bpmn instanceof BPMNModel) {
                    acyclicProcesses = union(acyclicProcesses, bpmn.getProcesses.reduce((a, p) => {
                        a = union(a, decomposeProcess(p));
                        return a;
                    }, {}));
                }
            });
            return acyclicProcesses;
        };

        /**
         * Decompose (sometimes recursively) a process model.
         * @param process The process model.
         * @returns {{}}
         */
        let decomposeProcess = function (process) {
            let loops = process.getLoops;
            if (loops.length === 0) {
                // The process model is already acyclic and needs no decomposition.
                let self = {};
                self[process.getId] = process;
                return self;
            }

            // Else ...
            removeDeadLoops(process);
            let fragments = decomposeLoops(process);
            let allFragments = {};
            for (let fragment of asList(fragments)) {
                allFragments = union(allFragments, decomposeProcess(fragment));
            }

            return allFragments;
        }

        /**
         * Decompose the loops of the process model.
         * @param process The process model.
         * @returns {{}}
         */
        let decomposeLoops = function (process) {
            let processes = { };
            processes[process.getId] = process;

            process.getLoops.forEach(function (loop) {
                if (asList(loop.getExits).length === 0) {
                    for (let node of asList(loop.getNodes)) {
                        if (!(node.getId in loop.getEntries)) {
                            delete process.getNodes[node.getId];
                        }
                    }
                    for (let edge of asList(process.getEdges)) {
                        if (edge.getSource.getId in loop.getNodes) {
                            delete process.getEdges[edge.getId];
                        }
                    }
                } else {
                    let identifierExit = asList(loop.getExits)[0];
                    // Create a new process for the loop if it is not already there.
                    let loopProcess = null;
                    let newProcess = false;
                    if (!(identifierExit.getId in uniqueLoops)) {
                        loopProcess = new LoopProcess(identifierExit.getId);
                        loopProcess.setSuper(process);
                        processes[loopProcess.getId] = loopProcess;
                        uniqueLoops[identifierExit.getId] = loopProcess;

                        // Copy all nodes of the loop
                        for (let node of asList(loop.getNodes)) {
                            let copy = node.copy;
                            loop.getNodes[node.getId] = copy;
                            if (node.getId in loop.getEntries) loop.getEntries[node.getId] = copy;
                            if (node.getId in loop.getExits) loop.getExits[node.getId] = copy;
                            loopProcess.addNode(copy);
                        }
                        newProcess = true;
                    } else loopProcess = uniqueLoops[identifierExit.getId];

                    // Determine the entries and exits
                    let realEntries = {};
                    if (loop.getDoBody !== null) {
                        realEntries = intersect(loop.getExits, loop.getDoBody);
                    } else realEntries = loop.getEntries;
                    let processRealEntries = intersect(process.getNodes, realEntries);
                    let processExits = intersect(process.getNodes, loop.getExits);

                    // Repair all exits and entries
                    asList(loop.getExits).forEach(el => {
                        if (el.getKind !== GatewayType.XOR) {
                            el.setKind(GatewayType.XOR);
                            el.setRepaired(true);
                        }
                    });
                    asList(loop.getEntries).forEach(el => {
                        if (el.getKind === GatewayType.AND) {
                            el.setKind(GatewayType.OR);
                            el.setRepaired(true);
                        }
                    });

                    // Remove all nodes of the loop being not in its do-body (except the exits).
                    let nonDoBody = diff(loop.getNodes, loop.getDoBody);
                    nonDoBody = union(nonDoBody, processExits);
                    process.setNodes(diff(process.getNodes, nonDoBody));

                    // Insert a loop node for the loop
                    let loopNode = new LoopTask('ln' + elementId++, loopProcess);
                    loopNode.setUI(loop.getUI);
                    loopNode.addElementId(loop.elementIds);
                    process.addNode(loopNode);
                    // Insert the converging gateway
                    let xorCon = new LoopEntryGateway('ln' + elementId++, processRealEntries);
                    xorCon.setUI(asList(processRealEntries).map(p => p.getUI));
                    xorCon.addElementId(flatten(asList(processRealEntries).map(p => p.elementIds)));
                    process.addNode(xorCon);
                    // Insert the diverging gateway
                    let xorDiv = new LoopExitGateway('ln' + elementId++, processExits);
                    xorDiv.setUI(asList(processExits).map(p => p.getUI));
                    xorDiv.addElementId(flatten(asList(processExits).map(p => p.elementIds)));
                    process.addNode(xorDiv);
                    // Add edges
                    let inL = new Edge('ln' + elementId++, xorCon, loopNode);
                    inL.setUI(loopNode.getUI);
                    inL.addElementId(loopNode.elementIds);
                    process.addEdge(inL);
                    let outL = new Edge('ln' + elementId++, loopNode, xorDiv);
                    outL.setUI(loopNode.getUI);
                    outL.addElementId(loopNode.elementIds);
                    process.addEdge(outL);
                    xorCon.addPostset(loopNode); loopNode.addPreset(xorCon);
                    loopNode.addPostset(xorDiv); xorDiv.addPreset(loopNode);

                    // Insert edges from the entries (exits being in the do-body) to the converging XOR.
                    asList(processRealEntries).forEach(entry => {
                        xorCon.setPreset(union(xorCon.getPreset, intersect(entry.getPreset, loop.getDoBody)));
                    })
                    // Insert edges from the diverging XOR to all nodes outside the loop and in the postset of exits.
                    asList(processExits).forEach(exit => {
                        xorDiv.setPostset(union(xorDiv.getPostset, diff(exit.getPostset, loop.getNodes)));
                    });
                    // We have to update the predecessors and successors, respectively, of the loop entries and exits.
                    asList(xorCon.getPreset).forEach(pred => {
                        pred.setPostset(diff(pred.getPostset, realEntries));
                        pred.addPostset(xorCon);
                        let edge = new Edge('ln' + elementId++, pred, xorCon);
                        process.addEdge(edge);
                        asList(pred.getOutgoing).forEach(o => {
                            if (o.getTarget.getId in realEntries) {
                                edge.setUI(o.getUI);
                                edge.addElementId(o.elementIds);
                            }
                        });
                    });

                    asList(xorDiv.getPostset).forEach(succ => {
                        succ.setPreset(diff(succ.getPreset, loop.getExits));
                        succ.addPreset(xorDiv);
                        let edge = new Edge('ln' + elementId++, xorDiv, succ);
                        process.addEdge(edge);
                        asList(succ.getIncoming).forEach(i => {
                            if (i.getSource.getId in loop.getExits) {
                                edge.setUI(i.getUI);
                                edge.addElementId(i.elementIds);
                            }
                        });
                    });
                    if (asList(xorCon.getPreset).length === 1) {
                        let xorConT = new VirtualTask(xorCon.getId);
                        xorConT.setUI(xorCon.getUI);
                        xorConT.addElementId(xorCon.elementIds);
                        process.replaceNode(xorCon, xorConT);
                        xorCon = xorConT;
                    }
                    if (asList(xorDiv.getPostset).length === 1) {
                        let xorDivT = new VirtualTask(xorDiv.getId);
                        xorDivT.setUI(xorDiv.getUI);
                        xorDivT.addElementId(xorDiv.elementIds);
                        process.replaceNode(xorDiv, xorDivT);
                        xorDiv = xorDivT;
                    }

                    // There are too much flows in the process and not enough in the loop process
                    asList(process.getEdges).forEach((flow) => {
                        let source = flow.getSource, target = flow.getTarget;

                        // There are variants:
                        // 1. Parts of the edges are not in the process anymore: Remove them from the process.
                        let srcExists = (source.getId in process.getNodes);
                        let tgtExists = (target.getId in process.getNodes);
                        if (!srcExists || !tgtExists) {
                            if (srcExists || tgtExists) {
                                if (tgtExists) delete target.getPreset[source.getId];
                                else delete source.getPostset[target.getId];
                            }
                            delete process.getEdges[flow.getId];
                        }
                        // 2. The edge is connected to the loop
                        if (newProcess && ((source.getId in loop.getNodes) || (target.getId in loop.getNodes))) {
                            // a. The edge has a loop exit as target
                            if (target.getId in loop.getExits) {
                                // Insert a new start
                                let lTarget = loop.getNodes[target.getId];
                                let start = new Start('ln' + elementId++, 'Start');
                                start.setUI(source.getUI);
                                start.addElementId(source.elementIds);
                                loopProcess.addNode(start);
                                let startEdge = new Edge('ln' + elementId++, start, lTarget);
                                startEdge.setUI(start.getUI);
                                startEdge.addElementId(start.elementIds);
                                loopProcess.addEdge(startEdge);

                                // Insert a new end (the source must be in the loop)
                                let lSource = loop.getNodes[source.getId];
                                if (target.getId in realEntries) {
                                    // Insert a new gateway, which represents the old exit
                                    let g = new Gateway('ln' + elementId++, null, GatewayType.XOR);
                                    g.setUI(target.getUI);
                                    g.addElementId(target.elementIds);
                                    loopProcess.addNode(g);
                                    let gEdge = new Edge('ln' + elementId++, lSource, g);
                                    gEdge.setUI(g.getUI);
                                    gEdge.addElementId(g.elementIds);
                                    loopProcess.addEdge(gEdge);
                                    // Insert a start node coming from outside the loop
                                    let start2 = new Start('ln' + elementId++, 'Start');
                                    start2.setUI(target.getUI);
                                    start2.addElementId(target.elementIds);
                                    loopProcess.addNode(start2);
                                    let start2Edge = new Edge('ln' + elementId++, start2, g);
                                    start2Edge.setUI(start2.getUI);
                                    start2Edge.addElementId(start2.elementIds);
                                    loopProcess.addEdge(start2Edge);

                                    let end = new End('ln' + elementId++, 'End');
                                    end.setUI(target.getUI);
                                    end.addElementId(target.elementIds);
                                    loopProcess.addNode(end);
                                    let endEdge = new Edge('ln' + elementId++, g, end);
                                    endEdge.setUI(end.getUI);
                                    endEdge.addElementId(end.elementIds);
                                    loopProcess.addEdge(endEdge);
                                } else {
                                    let end = new End('ln' + elementId++, 'End');
                                    end.setUI(target.getUI);
                                    end.addElementId(target.elementIds);
                                    loopProcess.addNode(end);
                                    let endEdge = new Edge('ln' + elementId++, lSource, end);
                                    endEdge.setUI(end.getUI);
                                    endEdge.addElementId(end.elementIds);
                                    loopProcess.addEdge(endEdge);
                                }

                                delete lTarget.getPreset[source.getId];
                                delete lSource.getPostset[target.getId];

                            } else if (source.getId in loop.getExits && !(target.getId in loop.getNodes)) {
                                // Insert a new end
                                let lSource = loop.getNodes[source.getId];
                                let end = new End('ln' + elementId++, 'End');
                                end.setUI(source.getUI);
                                end.addElementId(source.elementIds);
                                loopProcess.addNode(end);
                                let endEdge = new Edge('ln' + elementId++, lSource, end);
                                endEdge.setUI(end.getUI);
                                endEdge.addElementId(end.elementIds);
                                loopProcess.addEdge(endEdge);

                                // We do not need the flow in the loop net, so we do not add it.
                            } else {
                                // b. The flow is an inner flow, add it.
                                if ((source.getId in loop.getNodes) && (target.getId in loop.getNodes)) {
                                    let edge = new Edge(flow.getId, loopProcess.getNodes[source.getId], loopProcess.getNodes[target.getId]);
                                    edge.setUI(flow.getUI);
                                    edge.addElementId(flow.elementIds);
                                    loopProcess.addEdge(edge);
                                }
                            }
                        }
                    });

                    // If a new process was created, normalize it.
                    if (newProcess) {
                        Normalizer.normalizeProcess(loopProcess, false);
                    }
                }

            });
            // The process model does not contain these loops now. However, there could be still nested loops.
            process.setLoops(null);
            // Normalize the process model for the next round.
            Normalizer.normalizeProcess(process, false);

            return processes;
        }

        let removeDeadLoops = function (process) {
            let dead = {};
            let liveLoops = process.getLoops.filter(loop => {
                if (!loop.isDead && asList(loop.getExits).length >= 1) return true;

                asList(loop.getNodes).forEach(n => {
                    delete process.getNodes[n.getId];
                    asList(union(n.getIncoming, n.getOutgoing)).forEach(e => {
                        dead[e.getSource.getId] = e.getSource;
                        dead[e.getTarget.getId] = e.getTarget;
                        delete process.getEdges[e.getId];
                    });
                });

                return false;
            });
            process.setLoops(liveLoops);
            process.computeInOut();
            // Remove dead nodes and edges
            do {
                dead = intersect(dead, process.getNodes);
                if (asList(dead).length > 0) {
                    let deadNode = asList(dead).shift();
                    delete dead[deadNode.getId];
                    if (asList(deadNode.getIncoming).length === 0) {
                        // It is really dead.
                        delete process.getNodes[deadNode.getId];
                        asList(deadNode.getOutgoing).forEach(o => {
                            let t = o.getTarget;
                            delete t.getIncoming[o.getId];
                            delete process.getEdges[o.getId];
                            dead[t.getId] = t;
                        });
                    }
                }
            } while (asList(dead).length > 0);
            process.computeInOut();
        }
    }

    return function() {
        return new LoopDecompositionFactory();
    }
})();

export { LoopDecomposition };