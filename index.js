import fs from 'fs';
import { parse } from "csv-parse/sync";
import csvWriter from "csv-writer";

const ASSIGNMENT_HEADER = "Attendance: Interaction Design (2707791)";
const DURATION = parseInt(fs.readFileSync("./includes/duration.secret").toString().trim());


console.log("Beginning attendance report...");

const ignores = fs.readFileSync("./includes/ignores.csv").toString().split(/\r?\n/).slice(1);

const mappings = parse(fs.readFileSync("./includes/mappings.csv"), {
    columns: true,
    skip_empty_lines: true
}).reduce((acc, curr) => {
    return {
        ...acc,
        [curr.zoom]: curr.gradebook
    }
}, {});

const students = parse((() => {
    const lines = fs.readFileSync("./includes/gradebook.csv").toString().split(/\r?\n/);
    return [lines[0], ...lines.slice(3)].join("\n"); // ignore weird rows in gradebook.csv
})(), {
    columns: true,
    skip_empty_lines: true,
    on_record: (record) => record["Student"] === "Student, Test" ? undefined : {
        "Student": record["Student"],
        "ID": record["ID"],
        "SIS User ID": record["SIS User ID"],
        "SIS Login ID": record["SIS Login ID"],
        "Section": record["Section"]
    }
});

const timeReport = parse(fs.readFileSync("./includes/participants.csv"), {
    columns: true,
    skip_empty_lines: true
}).reduce((acc, par) => {
    const email = (() => {
        const email = par["Email"];
        return mappings[email] ?? email;
    })().toLowerCase();
    const studMatch = students.find(stud => stud["SIS Login ID"].toLowerCase() === email)
    if (studMatch) {
        // console.log("Exists!");
        const officialEmail = studMatch["SIS Login ID"];
        if (!acc[officialEmail]) {
            acc[officialEmail] = 0;
        }
        acc[officialEmail] += parseInt(par["Duration (minutes)"]);
    } else if (ignores.find(i => i.toLowerCase() === email)) {
        // intentionally left blank
    } else {
        console.warn("Warning! Could not find student by participant information below. Please add their alias to mappings.csv.", par);
    }
    return acc;
}, {});

if (Object.entries(timeReport).filter(tr => tr[1] < DURATION).length === 0) {
    console.log(`All students met the time requirement of ${DURATION} minutes!`)
} else {
    console.warn(`The following students attended but did not meet the time requirement of ${DURATION} minutes...`);
    console.warn(Object.entries(timeReport).filter(tr => tr[1] < DURATION));
}


await csvWriter.createObjectCsvWriter({
    path: "upload.csv",
    header: ["Student", "ID", "SIS User ID", "SIS Login ID", "Section", ASSIGNMENT_HEADER].map(o => {
        return {
            title: o,
            id: o
        }
    })
}).writeRecords(students.map(stud => {
    return {
        ...stud,
        [ASSIGNMENT_HEADER]: (timeReport[stud["SIS Login ID"]] ?? 0) >= DURATION ? 1 : 0
    }
}))

const attendance = parse(fs.readFileSync("./upload.csv"), {
    columns: true,
    skip_empty_lines: true
}).reduce((acc, par) => acc + parseInt(par[ASSIGNMENT_HEADER]), 0);

console.log(`Done! ${attendance} of ${students.length} received credit for ${ASSIGNMENT_HEADER}`)