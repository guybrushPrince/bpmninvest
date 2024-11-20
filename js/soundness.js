/**
 * Verifies acyclic process models regarding soundness. It uses two different analyses, one for deadlocks and one for
 * lack of synchronizations. The approach is based on:
 *
 * Thomas M. Prinz, Wolfram Amme:
 * Control-Flow-Based Methods to Support the Development of Sound Workflows.
 * Complex Syst. Informatics Model. Q. 27: 1-44 (2021)
 * DOI: https://doi.org/10.7250/csimq.2021-27.01
 *
 */
let SoundnessVerifier = (function () {

    let elementId = 0;

    function SoundnessVerifierFactory() {

        this.check = function (acyclicProcesses) {
            if (typeof acyclicProcesses === 'object') acyclicProcesses = asList(acyclicProcesses);
            if (!Array.isArray(acyclicProcesses)) acyclicProcesses = [ acyclicProcesses ];
            acyclicProcesses.forEach((process) => {
                checkDeadlocks(process);
                checkLacksOfSynchronization(process);
            });
        };

        /**
         * Check whether the given process model contains (potential) deadlocks.
         * @param process The process model.
         */
        let checkDeadlocks = function (process) {
            let andJoins = asList(process.getNodes).filter(n =>
                (n instanceof Gateway && n.getKind === GatewayType.AND && asList(n.getIncoming).length >= 2));
            // Determine those nodes, which ensures that the AND joins are executed.
            let andTriggers = determineANDTriggers(andJoins, process);
            // The topological sort speeds up the algorithm since the model is acyclic.
            let topOrder = topologicalSort(process);
            let all = andJoins.reduce((a,j) => {
                a[j.getId] = j;
                return a;
            }, {});

            // A kind of data-flow analysis starting from start nodes, which contains as information the set of all
            // AND joins.
            let info = process.getStarts.reduce((i,n) => {
                i[n.getId] = union(all, {});
                return i;
            }, {});
            // For each node, the predecessors are investigated and their information are at first combined, i.e.,
            // they contain all AND joins with a path without triggers.
            // Then the triggers are removed ("killed") from this information for the current node.
            topOrder.forEach((n) => {
                if (asList(n.getPreset).length > 0) {
                    info[n.getId] = asList(n.getPreset).reduce((i, p) => {
                        i = union(i, info[p.getId]);
                        return i;
                    }, {});
                }
                // Kill information.
                info[n.getId] = diff(info[n.getId], andTriggers[n.getId]);
            });
            // info contains the set of join nodes at the start(s) and are propagated through the process model.
            // All AND joins a node triggers are eliminated from its info set.
            // If the join reaches itself, then there is a path from the start to that join without a trigger.
            // This path could be reproduced to find the cause.
            andJoins.forEach(j => {
                if (j.getId in info[j.getId]) {
                    faultBus.addError(process, {
                        join: j
                    }, FaultType.POTENTIAL_DEADLOCK);
                }
            });
        }

        /**
         * Determine the triggers of AND joins. These are those nodes, which trigger all predecessors of the AND gateway.
         * @param andJoins The AND joins.
         * @param process The process model.
         * @returns {{}}
         */
        let determineANDTriggers = function (andJoins, process) {
            let triggers = determineTriggers(process);
            return Object.keys(triggers).reduce((jt, t) => {
                jt[t] = andJoins.reduce((at, j) => {
                    if (asList(diff(j.getPreset, triggers[t])).length === 0) {
                        at[j.getId] = j;
                    }
                    return at;
                }, {});
                return jt;
            }, {});
        }

        /**
         * Determines the triggering relation.
         *
         * This is partly based on the triggering relation of:
         *
         * Prinz, T. M., Ha, L. & Welsch, T. (2024).
         * Recognizing Relationships: Detecting the 4C Spectrum in O(P² + T²) for Acyclic Processes.
         * In: 28th International Conference on Enterprise Design, Operations, and Computing (EDOC 2024),
         * September 10-13, 2024, Vienna, Austria.
         *
         * @param process The process model of class Process.
         * @returns {}
         */
        let determineTriggers = function (process) {
            let R = {};
            // The acyclic process model is traversed in reverse topological order such that all successors are computed
            // if the next node is handled.
            let L = reverseTopologicalSort(process);
            L.forEach(x => {
                let tpost = Object.keys(x.getPostset);
                let tmpR = {};
                if (tpost.length > 0) {
                    tmpR = union(R[tpost[0]], {});
                    if (x instanceof Gateway && (x.getKind === GatewayType.XOR || x.getKind === GatewayType.OR)) {
                        // XOR and OR do not guarantee the execution for all nodes, only for those, all successors
                        // guarantee to execute.
                        for (let i = 1; i < tpost.length; i++) {
                            tmpR = intersect(tmpR, R[tpost[i]]);
                        }
                    } else {
                        // All other nodes guarantee to execute all nodes their successors guarantee to execute..
                        for (let i = 1; i < tpost.length; i++) {
                            tmpR = union(tmpR, R[tpost[i]]);
                        }
                    }
                }
                // Finally each node triggers itself.
                tmpR[x.getId] = x;
                R[x.getId] = tmpR;
            });

            return R;
        }

        /**
         * Orders the nodes of the process model topologically.
         *
         * The algorithm is taken from:
         *
         * Cormen, T.H., Leiserson, C.E., Rivest, R.L., Stein, C.:
         * Introduction to Algorithms
         * 3rd Edition. MIT Press (2009)
         *
         * @param process The process of class Process.
         */
        let topologicalSort = function (process) {
            let L = [];
            let S = process.getStarts.concat([]);
            let presets = {};
            asList(process.getNodes).forEach(n => {
                presets[n.getId] = union(n.getPreset, {});
            });

            while (S.length > 0) {
                let n = S.pop();
                L.push(n);
                asList(n.getPostset).forEach(m => {
                    delete presets[m.getId][n.getId];
                    if (asList(presets[m.getId]).length === 0) {
                        S.push(m);
                    }
                });
            }

            return L;
        }

        /**
         * Orders the nodes of the process model reverse topologically.
         *
         * The algorithm is taken from:
         *
         * Cormen, T.H., Leiserson, C.E., Rivest, R.L., Stein, C.:
         * Introduction to Algorithms
         * 3rd Edition. MIT Press (2009)
         *
         * @param process The process of class Process.
         */
        let reverseTopologicalSort = function (process) {
            let L = [];
            let S = process.getEnds;
            let postsets = {};
            asList(process.getNodes).forEach(n => {
                postsets[n.getId] = union(n.getPostset, {});
            });

            while (S.length > 0) {
                let n = S.pop();
                L.push(n);
                asList(n.getPreset).forEach(m => {
                    delete postsets[m.getId][n.getId];
                    if (asList(postsets[m.getId]).length === 0) {
                        S.push(m);
                    }
                });
            }
            return L;
        }



        /*
         * Lack of synchronization
         */

        /**
         * Checks whether the given process model contains potential lacks of synchronization.
         *
         * The algorithm is based on the finding of intersection points where an intersection point is a gateway, in
         * which two paths starting after an AND or an OR split firstly meet.
         * To find those intersection points, the concept of finding Phi functions for the Static Single Assignment (SSA)
         * form.
         *
         * The algorithm of finding Phi functions is based on:
         *
         * Ron Cytron, Jeanne Ferrante, Barry K. Rosen, Mark N. Wegman, F. Kenneth Zadeck:
         * Efficiently Computing Static Single Assignment Form and the Control Dependence Graph.
         * ACM Trans. Program. Lang. Syst. 13(4): 451-490 (1991)
         * DOI: https://doi.org/10.1145/115372.115320
         *
         * @param process The process model as class of Process
         */
        let checkLacksOfSynchronization = function (process) {
            let phiFunctions = setPhiFunctions(process);
            for (let j in phiFunctions) {
                let sync = process.getNodes[j];
                if (!(sync instanceof Gateway) || sync.getKind !== GatewayType.XOR ||
                    asList(sync.getPreset).length <= 1) continue;
                let syncPhis = phiFunctions[j];
                for (let s in syncPhis) {
                    if (asList(syncPhis[s]).length >= 2) {
                        let split = process.getNodes[s];

                        let syncPhisFine = {};
                        for (let p in syncPhis[s]) {
                            let n = syncPhis[s][p];
                            while (!(n.getId in split.getPostset)) {
                                n = phiFunctions[n.getId][split.getId];
                                n = asList(n)[0];
                            }
                            syncPhisFine[n.getId] = n;
                        }

                        faultBus.addError(process, {
                            split: split,
                            postset: syncPhisFine,
                            intersectionPoint: sync
                        }, FaultType.POTENTIAL_LACK_OF_SYNCHRONIZATION);
                    }
                }
            }
        };

        /**
         * Sets (virtually) phi functions on converging nodes. This is based on dominance frontiers.
         * A dominance frontier is a node, where the dominance of another node ends. Dominance is an important concept
         * from compiler theory.
         * @param process The process model of type Process.
         * @returns {{}}
         */
        let setPhiFunctions = function(process) {
            let phiFunctions = {};
            let dominanceFrontierSet = dominanceFrontier(process, dominance(process));

            // Get AND and OR splits.
            let psplits = asList(process.getNodes).filter(n =>
                ((n instanceof Gateway && (n.getKind === GatewayType.AND || n.getKind === GatewayType.OR) &&
                    asList(n.getPostset).length >= 2)));

            psplits.forEach(s => {
                // Get the successors of s where the virtual variables are defined, for which we search the phi places.
                let defineEdges = asList(s.getPostset);
                while (defineEdges.length > 0) {
                    let n = defineEdges.shift();

                    asList(dominanceFrontierSet[n.getId]).forEach(sync => {
                        if (!(sync.getId in phiFunctions)) phiFunctions[sync.getId] = {};
                        let syncPhiFunctions = phiFunctions[sync.getId];
                        if (!(s.getId in syncPhiFunctions)) syncPhiFunctions[s.getId] = {};
                        syncPhiFunctions[s.getId][n.getId] = n;
                        defineEdges.push(sync);
                    });
                }
            });
            return phiFunctions;
        };

        /**
         * To find the dominance frontiers, the dominance relation must be computed. One node dominates another node if
         * it is on all paths from the start to this node. The here used algorithm is based on:
         *
         * Cooper, Keith D. and Harvey, Timothy J. and Kennedy, Ken:
         * A Simple, Fast Dominance Algorithm
         * Rice Computer Science TR-06-33870
         *
         * @param process The process model of type Process.
         * @returns {*}
         */
        let dominance = function (process) {
            // Some help sets
            let defined = {};
            let IN = {};
            let dominatedOf = asList(process.getNodes).reduce((d,n) => {
                d[n.getId] = [];
                return d;
            }, {});

            // Get start nodes
            let starts = process.getStarts;
            starts.forEach(s => {
                dominatedOf[s.getId].push(s.getId)
                defined[s.getId] = s;
            });

            let orderInfo = reversePostorder(process);
            let order = orderInfo.order, postOrderNumbers = orderInfo.numbers;

            // This is a fixed point analysis, i.e., the algorithm terminates when no information changes.
            let stable;
            do {
                stable = true;
                order.forEach(node => {
                    if (node instanceof Start) return;
                    IN = {};
                    IN = union(IN, node.getPreset);
                    IN = intersect(IN, defined);
                    let pre = asList(IN);

                    if (pre.length > 0) {
                        let j = pre.pop();
                        let idom = j;
                        for (j of pre) {
                            idom = intersectDom(j, idom, dominatedOf, postOrderNumbers);
                        }
                        if (!(node.getId in defined)) {
                            defined[node.getId] = node;
                            dominatedOf[node.getId].push(idom);
                            stable = false;
                        } else {
                            let idomOld = dominatedOf[node.getId].at(-1);
                            if (postOrderNumbers[idomOld.getId] !== postOrderNumbers[idom.getId]) {
                                dominatedOf[node.getId].push(idom);
                                stable = false;
                            }
                        }
                    }
                });
            } while (!stable);
            return dominatedOf;
        };

        /**
         * Helper function of the dominance algorithm of Cooper et al.
         * @param finger1 A node.
         * @param finger2 A second node.
         * @param dominatedOf The dominance relation.
         * @param postOrderNumbers The post order numbers.
         * @returns {*}
         */
        let intersectDom = function (finger1, finger2, dominatedOf, postOrderNumbers) {
            while (postOrderNumbers[finger1.getId] !== postOrderNumbers[finger2.getId]) {
                while (postOrderNumbers[finger1.getId] < postOrderNumbers[finger2.getId]) {
                    finger1 = dominatedOf[finger1.getId].at(-1);
                }
                while (postOrderNumbers[finger2.getId] < postOrderNumbers[finger1.getId]) {
                    finger2 = dominatedOf[finger2.getId].at(-1);
                }
            }
            return finger1;
        }

        /**
         * Derive the dominance frontiers out of the dominance relation.
         * @param process The process model as instance of Process.
         * @param dominatedOf The dominance relation as Object.
         * @returns {*}
         */
        let dominanceFrontier = function (process, dominatedOf) {
            // Initialize with empty sets for each node.
            let dominanceFrontier = asList(process.getNodes).reduce((dF,n) => {
                dF[n.getId] = {};
                return dF;
            }, {});
            asList(process.getNodes).forEach(n => {
                let IN = asList(n.getPreset);
                if (IN.length >= 2) {
                    // Investigate the predecessors of each node.
                    for (let runner of IN) {
                        // Go back in the immediate dominance tree from runner as long it dominates NOT n.
                        while (runner.getId !== dominatedOf[n.getId].at(-1).getId) {
                            dominanceFrontier[runner.getId][n.getId] = n;
                            runner = dominatedOf[runner.getId].at(-1);
                        }
                    }
                }
            });
            return dominanceFrontier;
        }

        /**
         * Compute a reverse postorder, which is needed by the algorithm of Cooper et al. for dominance computation.
         * @param process The process model as instance of Process.
         * @returns {{numbers: {}, order: *[]}}
         */
        let reversePostorder = function (process) {
            let visited = {};
            let reversePostOrder = [];
            let postOrderNumbers = {};

            process.getStarts.forEach(s => {
                asList(s.getPostset).forEach(s => {
                    depthFirstSearch(s, visited, reversePostOrder, postOrderNumbers);
                })
            });
            return { order: reversePostOrder, numbers: postOrderNumbers };
        }

        let depthFirstSearch = function (n, visited, reversePostOrder, postOrderNumbers) {
            visited[n.getId] = n;
            let out = diff(n.getPostset, visited);
            asList(out).forEach(i => {
                depthFirstSearch(i, visited, reversePostOrder, postOrderNumbers);
            });
            postOrderNumbers[n.getId] = reversePostOrder.length;
            reversePostOrder.unshift(n);
        }

    }

    return function() {
        return new SoundnessVerifierFactory();
    }
})();