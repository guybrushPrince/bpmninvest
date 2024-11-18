let SoundnessVerifier = (function () {

    let elementId = 0;

    function SoundnessVerifierFactory() {

        this.check = function (acyclicProcesses) {
            if (typeof acyclicProcesses === 'object') acyclicProcesses = Object.values(acyclicProcesses);
            if (!Array.isArray(acyclicProcesses)) acyclicProcesses = [ acyclicProcesses ];
            acyclicProcesses.forEach((process) => {
                checkDeadlocks(process);
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
    }

    return function() {
        return new SoundnessVerifierFactory();
    }
})();