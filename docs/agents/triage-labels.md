# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Wayfinder ticket labels

`/wayfinder` labels map and child tickets with the same names as the skill uses; no mapping is needed:

| Ticket | Label |
| --- | --- |
| The map issue | `wayfinder:map` |
| Research ticket | `wayfinder:research` |
| Prototype ticket | `wayfinder:prototype` |
| Grilling / open-decision ticket | `wayfinder:grilling` |
| Plain task ticket | `wayfinder:task` |

Triage-role labels and wayfinder-type labels are independent: a child ticket normally carries one `wayfinder:<type>` label (plus `bug` when it is a defect), and exactly one triage-role label once it has been triaged.
