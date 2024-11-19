let SoundnessVerifier = (function () {

    let elementId = 0;

    function SoundnessVerifierFactory() {

        this.check = function (acyclicProcesses) {
            if (typeof acyclicProcesses === 'object') acyclicProcesses = Object.values(acyclicProcesses);
            if (!Array.isArray(acyclicProcesses)) acyclicProcesses = [ acyclicProcesses ];
            acyclicProcesses.forEach((process) => {
                checkDeadlocks(process);
                checkLacksOfSynchronization(process);
            });
        };

        let checkDeadlocks = function (process) {
            let andJoins = Object.values(process.getNodes).filter(n =>
                (n instanceof Gateway && n.getKind === GatewayType.AND && Object.values(n.getIncoming).length >= 2));
            let andTriggers = determineANDTriggers(andJoins, process);
            let topOrder = topologicalSort(process);
            let all = andJoins.reduce((a,j) => {
                a[j.getId] = j;
                return a;
            }, {});

            // A kind of data-flow analysis starting from start nodes.
            let info = process.getStarts.reduce((i,n) => {
                i[n.getId] = union(all, {});
                return i;
            }, {});
            topOrder.forEach((n) => {
                if (Object.values(n.getPreset).length > 0) {
                    info[n.getId] = Object.values(n.getPreset).reduce((i, p) => {
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

        let determineANDTriggers = function (andJoins, process) {
            let triggers = determineTriggers(process);
            return Object.keys(triggers).reduce((jt, t) => {
                jt[t] = andJoins.reduce((at, j) => {
                    if (Object.values(diff(j.getPreset, triggers[t])).length === 0) {
                        at[j.getId] = j;
                    }
                    return at;
                }, {});
                return jt;
            }, {});
        }

        /**
         * Determines the triggering relation.
         * @param process The process of class Process.
         * @return array
         */
        let determineTriggers = function (process) {
            let R = {};
            let L = reverseTopologicalSort(process);
            L.forEach(x => {
                let tpost = Object.keys(x.getPostset);
                let tmpR = {};
                if (tpost.length > 0) {
                    tmpR = union(R[tpost[0]], {});
                    if (x instanceof Gateway && (x.getKind === GatewayType.XOR || x.getKind === GatewayType.OR)) {
                        for (let i = 1; i < tpost.length; i++) {
                            tmpR = intersect(tmpR, R[tpost[i]]);
                        }
                    } else {
                        for (let i = 1; i < tpost.length; i++) {
                            tmpR = union(tmpR, R[tpost[i]]);
                        }
                    }
                }
                tmpR[x.getId] = x;
                R[x.getId] = tmpR;
            });

            return R;
        }

        /**
         * Orders the nodes of the process model topologically.
         * @param process The process of class Process.
         */
        let topologicalSort = function (process) {
            let L = [];
            let S = process.getStarts.concat([]);
            let presets = {};
            Object.values(process.getNodes).forEach(n => {
                presets[n.getId] = union(n.getPreset, {});
            });

            while (S.length > 0) {
                let n = S.pop();
                L.push(n);
                Object.values(n.getPostset).forEach(m => {
                    delete presets[m.getId][n.getId];
                    if (Object.values(presets[m.getId]).length === 0) {
                        S.push(m);
                    }
                });
            }

            return L;
        }

        /**
         * Orders the nodes of the process model reverse topologically.
         * @param process The process of class Process.
         */
        let reverseTopologicalSort = function (process) {
            let L = [];
            let S = process.getEnds;
            let postsets = {};
            Object.values(process.getNodes).forEach(n => {
                postsets[n.getId] = union(n.getPostset, {});
            });

            while (S.length > 0) {
                let n = S.pop();
                L.push(n);
                Object.values(n.getPreset).forEach(m => {
                    delete postsets[m.getId][n.getId];
                    if (Object.values(postsets[m.getId]).length === 0) {
                        S.push(m);
                    }
                });
            }
            return L;
        }



        /*
         * Lack of synchronization
         */

        let checkLacksOfSynchronization = function (process) {
            let phiFunctions = setPhiFunctions(process);
            for (let j in phiFunctions) {
                let sync = process.getNodes[j];
                if (!(sync instanceof Gateway) || sync.getKind !== GatewayType.XOR ||
                    Object.values(sync.getPreset).length <= 1) continue;
                let syncPhis = phiFunctions[j];
                for (let s in syncPhis) {
                    if (Object.values(syncPhis[s]).length >= 2) {
                        let split = process.getNodes[s];

                        let syncPhisFine = {};
                        for (let p in syncPhis[s]) {
                            let n = syncPhis[s][p];
                            while (!(n.getId in split.getPostset)) {
                                n = phiFunctions[n.getId][split.getId];
                                n = Object.values(n)[0];
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

        let setPhiFunctions = function(process) {
            let phiFunctions = {};
            let dominanceFrontierSet = dominanceFrontier(process, dominance(process));

            let psplits = Object.values(process.getNodes).filter(n =>
                ((n instanceof Gateway && (n.getKind === GatewayType.AND || n.getKind === GatewayType.OR) &&
                    Object.values(n.getPostset).length >= 2)));

            psplits.forEach(s => {
                // Get the successors of s where the virtual variables are defined
                let defineEdges = Object.values(s.getPostset);
                while (defineEdges.length > 0) {
                    let n = defineEdges.shift();

                    Object.values(dominanceFrontierSet[n.getId]).forEach(sync => {
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
         * Perform the dominance analysis.
         */
        let dominance = function (process) {
            // Some help sets
            let defined = {};
            let IN = {};
            let dominatedOf = Object.values(process.getNodes).reduce((d,n) => {
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

            let stable;
            do {
                stable = true;
                order.forEach(node => {
                    if (node instanceof Start) return;
                    IN = {};
                    IN = union(IN, node.getPreset);
                    IN = intersect(IN, defined);
                    let pre = Object.values(IN);

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

        let dominanceFrontier = function (process, dominatedOf) {
            let dominanceFrontier = Object.values(process.getNodes).reduce((dF,n) => {
                dF[n.getId] = {};
                return dF;
            }, {});
            Object.values(process.getNodes).forEach(n => {
                let IN = Object.values(n.getPreset);
                if (IN.length >= 2) {
                    for (let runner of IN) {
                        while (runner.getId !== dominatedOf[n.getId].at(-1).getId) {
                            dominanceFrontier[runner.getId][n.getId] = n;
                            runner = dominatedOf[runner.getId].at(-1);
                        }
                    }
                }
            });
            return dominanceFrontier;
        }

        let reversePostorder = function (process) {
            let visited = {};
            let reversePostOrder = [];
            let postOrderNumbers = {};

            process.getStarts.forEach(s => {
                Object.values(s.getPostset).forEach(s => {
                    depthFirstSearch(s, visited, reversePostOrder, postOrderNumbers);
                })
            });
            return { order: reversePostOrder, numbers: postOrderNumbers };
        }

        let depthFirstSearch = function (n, visited, reversePostOrder, postOrderNumbers) {
            visited[n.getId] = n;
            let out = diff(n.getPostset, visited);
            Object.values(out).forEach(i => {
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