import React, { useState, useMemo } from 'react';
import jsPDF from "jspdf";
import SudanMap from '../SudanMap';
import autoTable from "jspdf-autotable";
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// Assuming these are imported from a separate file
const COURSE_TYPES_FACILITATOR = ["IMNCI", "ETAT", "EENC", "IPC"];
const IMNCI_SUBCOURSE_TYPES = ["Standard 7 days course", "Refreshment course", "IMNCI in humanitarian setting", "online IMCI course", "preservice Course"];
const JOB_TITLES_IMNCI = ["Pediatric Doctor", "Family Medicine Doctor", "General Practioner", "Medical Assistance", "Treating Nurse", "Other"];
const JOB_TITLES_ETAT = ["Pediatric Specialist", "Pediatric registrar", "Family Medicine Doctor", "Emergency doctor", "General Practioner", "Nurse Diploma", "Nurse Bachelor", "Other"];
const JOB_TITLES_EENC = ["Pediatric doctor", "Obstetric Doctor", "Emergency doctor", "General Practioner", "Nurse Diploma", "Nurse Bachelor", "Sister Midwife", "Midwife", "Other"];
const Card = ({ children, className = '' }) => <div className={`bg-white rounded-lg shadow-md p-4 md:p-6 ${className}`}>{children}</div>;
const PageHeader = ({ title, subtitle }) => (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
            {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>
    </div>
);
const Button = ({ onClick, children, variant = 'primary', className = '' }) => <button onClick={onClick} className={`px-4 py-2 rounded-md font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2 justify-center bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-500 ${className}`}>{children}</button>;
const FormGroup = ({ label, children }) => (<div className="flex flex-col gap-1"><label className="font-semibold text-gray-700 text-sm">{label}</label>{children}</div>);
const Select = (props) => <select {...props} className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${props.className || ''}`}>{props.children}</select>;
const Table = ({ headers, children }) => (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm border-collapse">
            <thead className="bg-gray-100"><tr className="text-left text-gray-700">{headers.map((h, i) => <th key={i} className="py-3 px-4 font-semibold tracking-wider border border-gray-200">{h}</th>)}</tr></thead>
            <tbody className="bg-white">{children}</tbody>
        </table>
    </div>
);
const Input = (props) => <input {...props} className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${props.className || ''}`} />;
const EmptyState = ({ message, colSpan = 100 }) => (<tr><td colSpan={colSpan} className="py-12 text-center text-gray-500 border border-gray-200">{message}</td></tr>);


// Helper function to export table data to CSV/Excel
const exportToExcel = (tableData, headers, fileName) => {
    const csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(',') + '\n'
        + tableData.map(row => row.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Helper function to save table to PDF
const exportTableToPdf = (title, tableHeaders, tableBody, fileName, filters) => {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.text(title, 14, y);
    y += 7;

    doc.setFontSize(10);
    doc.setTextColor(100);
    const filterText = Object.entries(filters)
      .filter(([, value]) => value !== 'All' && value !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
    doc.text(`Filters applied: ${filterText || 'None'}`, 14, y);
    y += 10;

    autoTable(doc, {
        startY: y,
        head: [tableHeaders],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [8, 145, 178] },
    });
    doc.save(`${fileName}.pdf`);
};

function DashboardView({ allCourses, allParticipants, allFacilitators, onOpenCourseReport, onOpenParticipantReport, onOpenFacilitatorReport, STATE_LOCALITIES }) {
    if (!allCourses || !allParticipants || !allFacilitators) {
        return <div>Loading dashboard data...</div>;
    }

    const [viewType, setViewType] = useState('courses');
    const [courseTypeFilter, setCourseTypeFilter] = useState('All');
    const [stateFilter, setStateFilter] = useState('All');
    const [localityFilter, setLocalityFilter] = useState('All');
    const [yearFilter, setYearFilter] = useState('All');
    const [monthFilter, setMonthFilter] = useState('All');

    // Memos for filter options
    const allStates = useMemo(() => ['All', ...Object.keys(STATE_LOCALITIES).sort()], [STATE_LOCALITIES]);
    const allLocalities = useMemo(() => stateFilter === 'All' ? [] : ['All', ...STATE_LOCALITIES[stateFilter].sort()], [stateFilter, STATE_LOCALITIES]);
    const allCourseTypes = useMemo(() => ['All', ...COURSE_TYPES_FACILITATOR], []);
    const allYears = useMemo(() => {
        const years = [...new Set(allCourses.map(c => new Date(c.start_date).getFullYear()))].sort().map(String);
        return ['All', ...years];
    }, [allCourses]);
    const allMonths = useMemo(() => {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return ['All', ...months];
    }, []);
    const facilitatorRoles = ['All', 'directorCourse', 'isClinicalInstructor', 'teamLeaderCourse', 'followUpCourse'];

    // Main filtered data based on all filters
    const filteredCourses = useMemo(() => {
        return allCourses.filter(course => {
            const courseDate = new Date(course.start_date);
            const matchesCourseType = courseTypeFilter === 'All' || course.course_type === courseTypeFilter;
            const matchesState = stateFilter === 'All' || course.state === stateFilter;
            const matchesLocality = localityFilter === 'All' || course.locality === localityFilter;
            const matchesYear = yearFilter === 'All' || courseDate.getFullYear() === Number(yearFilter);
            const matchesMonth = monthFilter === 'All' || (courseDate.getMonth()) === allMonths.indexOf(monthFilter);

            return matchesCourseType && matchesState && matchesLocality && matchesYear && matchesMonth;
        });
    }, [allCourses, courseTypeFilter, stateFilter, localityFilter, yearFilter, monthFilter, allMonths]);

    const filteredParticipants = useMemo(() => {
        const matchingCourseIds = filteredCourses.map(c => c.id);
        return allParticipants.filter(p => matchingCourseIds.includes(p.courseId));
    }, [filteredCourses, allParticipants]);

    // Course Dashboard Logic
    const courseKPIs = useMemo(() => {
        const totalCourses = filteredCourses.length;
        const totalImnciCourses = filteredCourses.filter(c => c.course_type === 'IMNCI').length;
        const totalEtatCourses = filteredCourses.filter(c => c.course_type === 'ETAT').length;
        const totalEencCourses = filteredCourses.filter(c => c.course_type === 'EENC').length;

        return {
            totalCourses,
            totalImnciCourses,
            totalEtatCourses,
            totalEencCourses
        };
    }, [filteredCourses]);

    const coursesByState = useMemo(() => {
        const data = {};
        const allStatesInFilter = [...new Set(filteredCourses.map(c => c.state))].sort();
        const allCourseTypesInFilter = [...new Set(filteredCourses.map(c => c.course_type))].sort();
        const totalCounts = {};

        filteredCourses.forEach(c => {
            const state = c.state;
            const type = c.course_type;
            if (!data[state]) data[state] = {};
            data[state][type] = (data[state][type] || 0) + 1;
            totalCounts[state] = (totalCounts[state] || 0) + 1;
        });

        const tableBody = allStatesInFilter.map(state => {
            const row = [state];
            allCourseTypesInFilter.forEach(type => {
                row.push(data[state]?.[type] || 0);
            });
            row.push(totalCounts[state] || 0);
            return row;
        });

        // Calculate column totals
        const columnTotals = ["Total"];
        allCourseTypesInFilter.forEach(type => {
            const sum = Object.values(data).reduce((acc, stateData) => acc + (stateData[type] || 0), 0);
            columnTotals.push(sum);
        });
        const grandTotal = columnTotals.slice(1).reduce((acc, sum) => acc + sum, 0);
        columnTotals.push(grandTotal);

        return {
            headers: ["State", ...allCourseTypesInFilter, "Total"],
            body: tableBody,
            totals: columnTotals
        };
    }, [filteredCourses]);

    const allCoursesList = useMemo(() => {
        return filteredCourses.map(c => ({
            id: c.id,
            course_type: c.course_type,
            state: c.state,
            locality: c.locality,
            director: c.director,
            start_date: c.start_date,
            participants_count: c.participants_count
        }));
    }, [filteredCourses]);

    const allCoursesListHeaders = ["Course Type", "State", "Locality", "Course Director", "Start Date", "# Participants", "Actions"];

    // Participant Dashboard Logic
    const participantKPIs = useMemo(() => {
        const totalParticipants = filteredParticipants.length;
        const participantsByCourse = filteredParticipants.reduce((acc, p) => {
            const courseName = p.course_type || 'Unknown Course';
            acc[courseName] = (acc[courseName] || 0) + 1;
            return acc;
        }, {});
        return { totalParticipants, participantsByCourse };
    }, [filteredParticipants]);

    const trainedByCadreAndCourse = useMemo(() => {
        const data = {};
        const allCadres = [...new Set(filteredParticipants.map(p => p.job_title))].sort();
        const allCourseTypesInFilter = [...new Set(filteredCourses.map(c => c.course_type))].sort();

        filteredParticipants.forEach(p => {
            const courseType = p.course_type || 'Unknown';
            const cadre = p.job_title;
            if (!data[cadre]) data[cadre] = {};
            data[cadre][courseType] = (data[cadre][courseType] || 0) + 1;
        });

        const tableBody = allCadres.map(cadre => {
            const row = [cadre];
            allCourseTypesInFilter.forEach(courseType => {
                row.push(data[cadre]?.[courseType] || 0);
            });
            return row;
        });

        const columnTotals = ["Total"];
        allCourseTypesInFilter.forEach(type => {
            const sum = Object.values(data).reduce((acc, cadreData) => acc + (cadreData[type] || 0), 0);
            columnTotals.push(sum);
        });

        return {
            headers: ["Health Cadre", ...allCourseTypesInFilter],
            body: tableBody,
            totals: columnTotals
        };
    }, [filteredParticipants, filteredCourses]);

    const allParticipantsList = useMemo(() => {
        return filteredParticipants.map(p => {
            return {
                id: p.id,
                name: p.name,
                course: p.course_type || 'N/A',
                state: p.state,
                locality: p.locality,
                job_title: p.job_title,
                phone: p.phone,
            };
        });
    }, [filteredParticipants]);

    const participantsListHeaders = ["Name", "Course", "State", "Locality", "Job Title", "Phone", "Actions"];

    const currentFilters = {
      'Course Type': courseTypeFilter,
      'State': stateFilter,
      'Locality': localityFilter,
      'Year': yearFilter,
      'Month': monthFilter
    };

    // Map of Sudan logic
    // Using cities coordinates as a proxy for states and localities
    const mapCoordinates = {
        "Khartoum": { lat: 15.6000, lng: 32.5000 },
        "Gezira": { lat: 14.4000, lng: 33.5167 },
        "White Nile": { lat: 13.1667, lng: 32.6667 }, // Kūstī
        "Blue Nile": { lat: 11.7667, lng: 34.3500 }, // Ed Damazin
        "Sennar": { lat: 13.1500, lng: 33.9333 }, // Singa
        "Gedarif": { lat: 14.0333, lng: 35.3833 }, // Gedaref
        "Kassala": { lat: 15.4500, lng: 36.4000 },
        "Red Sea": { lat: 19.6167, lng: 37.2167 }, // Port Sudan
        "Northern": { lat: 19.1698, lng: 30.4749 }, // Dongola
        "River Nile": { lat: 17.5900, lng: 33.9600 }, // Ed Damer
        "North Kordofan": { lat: 13.1833, lng: 30.2167 }, // El Obeid
        "South Kordofan": { lat: 11.0167, lng: 29.7167 }, // Kadugli
        "West Kordofan": { lat: 11.7175, lng: 28.3400 }, // El Fula
        "North Darfur": { lat: 13.6306, lng: 25.3500 }, // El Fasher
        "South Darfur": { lat: 12.0500, lng: 24.8833 }, // Nyala
        "West Darfur": { lat: 13.4500, lng: 22.4500 }, // El Geneina
        "Central Darfur": { lat: 12.9000, lng: 23.4833 }, // Zalingei
        "East Darfur": { lat: 11.4608, lng: 26.1283 } // Ed Daein
    };

    const mapData = useMemo(() => {
        const courseCounts = {};
        filteredCourses.forEach(course => {
            const { state } = course;
            courseCounts[state] = (courseCounts[state] || 0) + 1;
        });

        return Object.entries(courseCounts).map(([state, count]) => {
            const coords = mapCoordinates[state];
            // Only return the item if coordinates are defined
            if (coords) {
                return {
                    state,
                    count,
                    coordinates: [coords.lng, coords.lat] // Marker expects [lng, lat]
                };
            }
            return null;
        }).filter(Boolean); // Filters out null values
    }, [filteredCourses]);


    // =========================================================================
    // NEW: FACILITATOR DASHBOARD LOGIC
    // =========================================================================
    const [facSearchQuery, setFacSearchQuery] = useState('');
    const [facStateFilter, setFacStateFilter] = useState('All');
    const [facLocalityFilter, setFacLocalityFilter] = useState('All');
    const [facRoleFilter, setFacRoleFilter] = useState('All');
    const [facCourseFilter, setFacCourseFilter] = useState('All');

    // This is now a top-level hook, ensuring it's not called conditionally
    const filteredFacilitators = useMemo(() => {
        return allFacilitators.filter(f => {
            const matchesSearch = facSearchQuery === '' || f.name.toLowerCase().includes(facSearchQuery.toLowerCase());
            const matchesCourse = facCourseFilter === 'All' || (f.courses && f.courses.includes(facCourseFilter));
            const matchesState = facStateFilter === 'All' || f.currentState === facStateFilter;
            const matchesLocality = facLocalityFilter === 'All' || f.currentLocality === facLocalityFilter;
            const matchesRole = facRoleFilter === 'All' || f[facRoleFilter] === 'Yes';
            return matchesSearch && matchesCourse && matchesState && matchesLocality && matchesRole;
        });
    }, [allFacilitators, facSearchQuery, facCourseFilter, facStateFilter, facLocalityFilter, facRoleFilter]);


    const facilitatorMapData = useMemo(() => {
        const facilitatorCounts = {};
        filteredFacilitators.forEach(f => {
            const { currentState } = f;
            if (currentState && currentState !== "Out of Sudan") {
                facilitatorCounts[currentState] = (facilitatorCounts[currentState] || 0) + 1;
            }
        });

        return Object.entries(facilitatorCounts).map(([state, count]) => {
            const coords = mapCoordinates[state];
            if (coords) {
                return {
                    state,
                    count,
                    coordinates: [coords.lng, coords.lat]
                };
            }
            return null;
        }).filter(Boolean);
    }, [filteredFacilitators]);

    const facilitatorDashboardData = useMemo(() => {
        const kpiData = {
            totalFacilitators: filteredFacilitators.length,
            directors: filteredFacilitators.filter(f => f.directorCourse === 'Yes').length,
            clinicalInstructors: filteredFacilitators.filter(f => f.isClinicalInstructor === 'Yes').length,
            teamLeaders: filteredFacilitators.filter(f => f.teamLeaderCourse === 'Yes').length,
            followUpSupervisors: filteredFacilitators.filter(f => f.followUpCourse === 'Yes').length,
        };

        const facilitatorAvailabilityByState = (() => {
            const data = {};
            const allStatesInFilter = [...new Set(filteredFacilitators.map(f => f.currentState))].filter(Boolean).sort();
            const allCourseTypes = [...new Set(filteredFacilitators.flatMap(f => f.courses || []))].sort();

            filteredFacilitators.forEach(f => {
                const state = f.currentState;
                f.courses?.forEach(courseType => {
                    if (state) {
                        data[state] = data[state] || {};
                        data[state][courseType] = (data[state][courseType] || 0) + 1;
                    }
                });
            });

            // Prepare table body with rows for each state
            const tableBody = allStatesInFilter.map(state => {
                const row = [state];
                let rowTotal = 0;
                allCourseTypes.forEach(courseType => {
                    const count = data[state]?.[courseType] || 0;
                    row.push(count);
                    rowTotal += count;
                });
                row.push(rowTotal);
                return row;
            });

            // Calculate column totals (for each course type) and grand total
            const totalRow = ["Total"];
            let grandTotal = 0;
            allCourseTypes.forEach(courseType => {
                const columnTotal = allStatesInFilter.reduce((sum, state) => sum + (data[state]?.[courseType] || 0), 0);
                totalRow.push(columnTotal);
                grandTotal += columnTotal;
            });
            totalRow.push(grandTotal);

            const tableHeaders = ["State", ...allCourseTypes, "Total"];

            const chartDatasets = allCourseTypes.map((courseType, index) => {
                const colors = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#6b7280'];
                return {
                    label: courseType,
                    data: allStatesInFilter.map(state => data[state]?.[courseType] || 0),
                    backgroundColor: colors[index % colors.length],
                };
            });

            const chartData = {
                labels: allStatesInFilter,
                datasets: chartDatasets
            };

            return {
                tableHeaders,
                tableBody,
                tableTotals: totalRow,
                chartData,
            };
        })();


        const facilitatorTableHeaders = ["Name", "Phone", "Email", "IMNCI Director?", "Clinical Instructor?", "Team Leader?", "Follow-up?", "Courses Instructed", "Courses Directed", "Actions"];
        const facilitatorTableData = filteredFacilitators.map(f => {
            const instructed = allCourses.filter(c => Array.isArray(c.facilitators) && c.facilitators.includes(f.name)).length;
            const directed = allCourses.filter(c => c.director === f.name).length;
            const hasFollowUp = f.followUpCourse === 'Yes' || f.followUpCourse === 'yes' ? 'Yes' : 'No';
            const hasTeamLeader = f.teamLeaderCourse === 'Yes' || f.teamLeaderCourse === 'yes' ? 'Yes' : 'No';
            const isDirector = f.directorCourse === 'Yes' || f.directorCourse === 'yes' ? 'Yes' : 'No';
            const isClinical = f.isClinicalInstructor === 'Yes' || f.isClinicalInstructor === 'yes' ? 'Yes' : 'No';
            return {
                id: f.id,
                row: [f.name, f.phone, f.email || 'N/A', isDirector, isClinical, hasTeamLeader, hasFollowUp, instructed, directed]
            };
        });

        const localitiesInSelectedState = facStateFilter === 'All' ? [] : STATE_LOCALITIES[facStateFilter] || [];

        return {
            filteredFacilitators,
            kpiData,
            facilitatorAvailabilityByState,
            facilitatorTableHeaders,
            facilitatorTableData,
            localitiesInSelectedState,
        };
    }, [filteredFacilitators, allCourses, facStateFilter, facLocalityFilter, facRoleFilter, STATE_LOCALITIES]);

    const FacilitatorMap = ({ data, mapCoordinates }) => {
        // Corrected geoUrl to point to the local file
        const geoUrl = "/sudan.json";
        const maxFacilitators = Math.max(...data.map(d => d.count), 1);

        return (
            <div className="w-full h-96 bg-gray-100 rounded-lg">
                 <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{ center: [30, 15], scale: 2000 }}
                    style={{ width: "100%", height: "100%" }}
                >
                    <Geographies geography={geoUrl}>
                        {({ geographies }) =>
                            geographies.map(geo => (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    style={{
                                        default: {
                                            fill: "#EAEAEC",
                                            stroke: "#D6D6DA",
                                            outline: "none"
                                        },
                                        hover: {
                                            fill: "#D6D6DA",
                                            stroke: "#D6D6DA",
                                            outline: "none"
                                        },
                                        pressed: {
                                            fill: "#D6D6DA",
                                            stroke: "#D6D6DA",
                                            outline: "none"
                                        }
                                    }}
                                />
                            ))
                        }
                    </Geographies>
                    {data.map(({ state, coordinates, count }) => (
                        <Marker key={state} coordinates={coordinates}>
                            <circle
                                r={Math.max(5, (count / maxFacilitators) * 20)}
                                fill="#0ea5e9"
                                stroke="#fff"
                                strokeWidth={2}
                                opacity={0.8}
                            />
                            <text
                                textAnchor="middle"
                                y={-Math.max(5, (count / maxFacilitators) * 20) - 5}
                                style={{ fontFamily: "system-ui", fill: "#5D5A6D", fontSize: "10px", fontWeight: "bold" }}
                            >
                                {state} ({count})
                            </text>
                        </Marker>
                    ))}
                </ComposableMap>
            </div>
        );
    };


    // =========================================================================
    // MAIN COMPONENT RENDER
    // =========================================================================
    return (
        <Card className="p-0">
            <PageHeader title="National Program Dashboard" subtitle="Overview of all courses, participants, and facilitators." />

            <div className="mb-6 flex flex-wrap items-center gap-4 px-4 md:px-6">
                <Button variant={viewType === 'courses' ? 'primary' : 'secondary'} onClick={() => setViewType('courses')}>Course Dashboard</Button>
                <Button variant={viewType === 'participants' ? 'primary' : 'secondary'} onClick={() => setViewType('participants')}>Participant Dashboard</Button>
                <Button variant={viewType === 'facilitators' ? 'primary' : 'secondary'} onClick={() => setViewType('facilitators')}>Facilitator Dashboard</Button>
            </div>

            {/* Filter section, visible for all views */}
            <div className="p-4 bg-gray-50 rounded-md mb-6 mx-4 md:mx-6">
                <h3 className="text-lg font-semibold mb-2">Filters</h3>
                <div className="grid md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {viewType === 'facilitators' ? (
                        <>
                            <FormGroup label="Search by Name"><Input type="text" value={facSearchQuery} onChange={(e) => setFacSearchQuery(e.target.value)} placeholder="Search name..." /></FormGroup>
                            <FormGroup label="Filter by Course">
                                <Select value={facCourseFilter} onChange={(e) => setFacCourseFilter(e.target.value)}>
                                    <option value="All">All Courses</option>
                                    {COURSE_TYPES_FACILITATOR.map(c => <option key={c} value={c}>{c}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Filter by State">
                                <Select value={facStateFilter} onChange={(e) => { setFacStateFilter(e.target.value); setFacLocalityFilter('All'); }}>
                                    <option value="All">All States</option>
                                    {Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}
                                    <option value="Out of Sudan">Out of Sudan</option>
                                </Select>
                            </FormGroup>
                            <FormGroup label="Filter by Locality">
                                <Select value={facLocalityFilter} onChange={(e) => setFacLocalityFilter(e.target.value)} disabled={facStateFilter === 'All' || facStateFilter === 'Out of Sudan'}>
                                    <option value="All">All Localities</option>
                                    {facilitatorDashboardData.localitiesInSelectedState.map(l => <option key={l} value={l}>{l}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Filter by Role">
                                <Select value={facRoleFilter} onChange={(e) => setFacRoleFilter(e.target.value)}>
                                    <option value="All">All Roles</option>
                                    <option value="directorCourse">IMNCI Director</option>
                                    <option value="isClinicalInstructor">Clinical Instructor</option>
                                    <option value="teamLeaderCourse">Team Leader</option>
                                    <option value="followUpCourse">Follow-up Supervisor</option>
                                </Select>
                            </FormGroup>
                        </>
                    ) : (
                        <>
                            <FormGroup label="Course Type">
                                <Select value={courseTypeFilter} onChange={e => setCourseTypeFilter(e.target.value)}>
                                    {allCourseTypes.map(c => <option key={c} value={c}>{c}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="State">
                                <Select value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
                                    {allStates.map(s => <option key={s} value={s}>{s}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Locality">
                                <Select value={localityFilter} onChange={e => setLocalityFilter(e.target.value)} disabled={stateFilter === 'All'}>
                                    {allLocalities.map(l => <option key={l} value={l}>{l}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Year">
                                <Select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                                    {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Month">
                                <Select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                                    {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
                                </Select>
                            </FormGroup>
                        </>
                    )}
                </div>
            </div>

            {viewType === 'courses' && (
                <div className="px-4 md:px-6">
                    <h3 className="text-xl font-bold mb-4">Course KPIs</h3>
                    <div className="grid md:grid-cols-4 gap-4 mb-8">
                        <div className="p-4 bg-sky-100 rounded-lg text-center">
                            <div className="text-sm font-semibold text-sky-700">Total Courses</div>
                            <div className="text-3xl font-bold">{courseKPIs.totalCourses}</div>
                        </div>
                        <div className="p-4 bg-sky-100 rounded-lg text-center">
                            <div className="text-sm font-semibold text-sky-700">Total IMNCI Courses</div>
                            <div className="text-3xl font-bold">{courseKPIs.totalImnciCourses}</div>
                        </div>
                        <div className="p-4 bg-sky-100 rounded-lg text-center">
                            <div className="text-sm font-semibold text-sky-700">Total ETAT Courses</div>
                            <div className="text-3xl font-bold">{courseKPIs.totalEtatCourses}</div>
                        </div>
                        <div className="p-4 bg-sky-100 rounded-lg text-center">
                            <div className="text-sm font-semibold text-sky-700">Total EENC Courses</div>
                            <div className="text-3xl font-bold">{courseKPIs.totalEencCourses}</div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="p-0">
                            <h4 className="font-semibold text-xl pl-4 pt-4 mb-0">Number of Courses by State</h4>
                            <div className="flex justify-end gap-2 p-4">
                                <Button variant="secondary" onClick={() => exportToExcel(coursesByState.body.concat([coursesByState.totals]), coursesByState.headers, "Course_Dashboard_by_State")}>Download Excel</Button>
                                <Button variant="secondary" onClick={() => exportTableToPdf("Courses by State", coursesByState.headers, coursesByState.body.concat([coursesByState.totals]), "Course_Dashboard_by_State", currentFilters)}>Save PDF</Button>
                            </div>
                            <Table headers={coursesByState.headers}>
                                {coursesByState.body.map((row, index) => (
                                    <tr key={index}>
                                        {row.map((cell, cellIndex) => (
                                            <td key={cellIndex} className="p-2 border">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                                <tr className="font-bold bg-gray-100">
                                    {coursesByState.totals.map((cell, index) => (
                                        <td key={index} className="p-2 border">{cell}</td>
                                    ))}
                                </tr>
                            </Table>
                        </Card>
                        <Card className="p-0">
                            <h4 className="font-semibold text-xl pl-4 pt-4 mb-0">Course Locations on Map</h4>
                           <SudanMap data={mapData} />
                        </Card>
                    </div>

                    <Card className="mt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold text-xl">All Courses List</h4>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => exportToExcel(allCoursesList.map(row => [row.course_type, row.state, row.locality, row.director, row.start_date, row.participants_count]), allCoursesListHeaders.slice(0, 6), "All_Courses")}>Download Excel</Button>
                                <Button variant="secondary" onClick={() => exportTableToPdf("All Courses List", allCoursesListHeaders.slice(0, 6), allCoursesList.map(row => [row.course_type, row.state, row.locality, row.director, row.start_date, row.participants_count]), "All_Courses", currentFilters)}>Save PDF</Button>
                            </div>
                        </div>
                        <Table headers={allCoursesListHeaders}>
                            {allCoursesList.map((course) => (
                                <tr key={course.id}>
                                    <td className="p-2 border">{course.course_type}</td>
                                    <td className="p-2 border">{course.state}</td>
                                    <td className="p-2 border">{course.locality}</td>
                                    <td className="p-2 border">{course.director}</td>
                                    <td className="p-2 border">{course.start_date}</td>
                                    <td className="p-2 border">{course.participants_count}</td>
                                    <td className="p-2 border">
                                        <Button onClick={() => onOpenCourseReport(course.id)}>View Report</Button>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    </Card>
                </div>
            )}

            {viewType === 'participants' && (
                <div className="px-4 md:px-6">
                    <h3 className="text-xl font-bold mb-4">Participant KPIs</h3>
                    <div className="grid md:grid-cols-4 gap-4 mb-8">
                        <div className="p-4 bg-sky-100 rounded-lg text-center">
                            <div className="text-sm font-semibold text-sky-700">Total Participants Trained</div>
                            <div className="text-3xl font-bold">{participantKPIs.totalParticipants}</div>
                        </div>
                        {Object.entries(participantKPIs.participantsByCourse).map(([course, count]) => (
                            <div key={course} className="p-4 bg-sky-100 rounded-lg text-center">
                                <div className="text-sm font-semibold text-sky-700">Participants in {course}</div>
                                <div className="text-3xl font-bold">{count}</div>
                            </div>
                        ))}
                    </div>

                    <Card className="mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold text-xl">Trained by Health Cadre (Disaggregated by Course Type)</h4>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => exportToExcel(trainedByCadreAndCourse.body.concat([trainedByCadreAndCourse.totals]), trainedByCadreAndCourse.headers, "Participant_Dashboard_by_Cadre")}>Download Excel</Button>
                                <Button variant="secondary" onClick={() => exportTableToPdf("Trained by Health Cadre", trainedByCadreAndCourse.headers, trainedByCadreAndCourse.body.concat([trainedByCadreAndCourse.totals]), "Participant_Dashboard_by_Cadre", currentFilters)}>Save PDF</Button>
                            </div>
                        </div>
                        <Table headers={trainedByCadreAndCourse.headers}>
                            {trainedByCadreAndCourse.body.map((row, index) => (
                                <tr key={index}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="p-2 border">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </Table>
                    </Card>

                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold text-xl">All Participants List</h4>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => exportToExcel(allParticipantsList.map(row => [row.name, row.course, row.state, row.locality, row.job_title, row.phone]), participantsListHeaders.slice(0, -1), "All_Participants")}>Download Excel</Button>
                                <Button variant="secondary" onClick={() => exportTableToPdf("All Participants List", participantsListHeaders.slice(0, -1), allParticipantsList.map(row => [row.name, row.course, row.state, row.locality, row.job_title, row.phone]), "All_Participants", currentFilters)}>Save PDF</Button>
                            </div>
                        </div>
                        <Table headers={participantsListHeaders}>
                            {allParticipantsList.map((p, index) => (
                                <tr key={index}>
                                    <td className="p-2 border">{p.name}</td>
                                    <td className="p-2 border">{p.course}</td>
                                    <td className="p-2 border">{p.state}</td>
                                    <td className="p-2 border">{p.locality}</td>
                                    <td className="p-2 border">{p.job_title}</td>
                                    <td className="p-2 border">{p.phone}</td>
                                    <td className="p-2 border">
                                        <Button onClick={() => onOpenParticipantReport(p.id, p.courseId)}>
    View Report
</Button>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    </Card>
                </div>
            )}

            {/* ==================================================================== */}
            {/* NEW: FACILITATOR DASHBOARD RENDER */}
            {/* ==================================================================== */}
            {viewType === 'facilitators' && (
                <div className="px-4 md:px-6">
                    <h3 className="text-xl font-bold mb-4">Facilitator KPIs</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 text-center mb-6">
                        <div className="p-4 bg-gray-100 rounded-lg">
                            <div className="text-sm text-gray-600">Total Facilitators</div>
                            <div className="text-3xl font-bold text-sky-700">{facilitatorDashboardData.kpiData.totalFacilitators}</div>
                        </div>
                        <div className="p-4 bg-gray-100 rounded-lg">
                            <div className="text-sm text-gray-600">Course Directors</div>
                            <div className="text-3xl font-bold text-sky-700">{facilitatorDashboardData.kpiData.directors}</div>
                        </div>
                        <div className="p-4 bg-gray-100 rounded-lg">
                            <div className="text-sm text-gray-600">Clinical Instructors</div>
                            <div className="text-3xl font-bold text-sky-700">{facilitatorDashboardData.kpiData.clinicalInstructors}</div>
                        </div>
                        <div className="p-4 bg-gray-100 rounded-lg">
                            <div className="text-sm text-gray-600">Team Leaders</div>
                            <div className="text-3xl font-bold text-sky-700">{facilitatorDashboardData.kpiData.teamLeaders}</div>
                        </div>
                        <div className="p-4 bg-gray-100 rounded-lg">
                            <div className="text-sm text-gray-600">Follow-up Supervisors</div>
                            <div className="text-3xl font-bold text-sky-700">{facilitatorDashboardData.kpiData.followUpSupervisors}</div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                        <Card>
                            <h3 className="text-xl font-bold mb-4">Facilitator Availability by State</h3>
                            <Table headers={facilitatorDashboardData.facilitatorAvailabilityByState.tableHeaders}>
                                {facilitatorDashboardData.facilitatorAvailabilityByState.tableBody.length === 0 ? <EmptyState message="No data to display." colSpan={facilitatorDashboardData.facilitatorAvailabilityByState.tableHeaders.length} /> :
                                    <>
                                        {facilitatorDashboardData.facilitatorAvailabilityByState.tableBody.map((row, index) => (
                                            <tr key={index}>
                                                {row.map((cell, cellIndex) => (
                                                    <td key={cellIndex} className="p-2 border">{cell}</td>
                                                ))}
                                            </tr>
                                        ))}
                                        <tr className="font-bold bg-gray-100">
                                            {facilitatorDashboardData.facilitatorAvailabilityByState.tableTotals.map((cell, index) => (
                                                <td key={index} className="p-2 border">{cell}</td>
                                            ))}
                                        </tr>
                                    </>
                                }
                            </Table>
                        </Card>
                        <Card>
                            <h3 className="text-xl font-bold mb-4">Facilitator Geographical Distribution</h3>
                            {/* Corrected: Pass the mapCoordinates prop to the FacilitatorMap component */}
                            <FacilitatorMap data={facilitatorMapData} mapCoordinates={mapCoordinates} />
                        </Card>
                    </div>

                    <Card className="mt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold text-xl">Facilitator Information Table</h4>
                        </div>
                        <Table headers={facilitatorDashboardData.facilitatorTableHeaders}>
                            {facilitatorDashboardData.facilitatorTableData.length === 0 ? <EmptyState message="No data to display." colSpan={facilitatorDashboardData.facilitatorTableHeaders.length} /> :
                                facilitatorDashboardData.facilitatorTableData.map(f => (
                                    <tr key={f.id} className="hover:bg-gray-50 text-center">
                                        {f.row.map((cell, i) => (
                                            <td key={i} className="p-2 border text-left">{cell}</td>
                                        ))}
                                        <td className="p-2 border text-left">
                                            <Button onClick={() => onOpenFacilitatorReport(f.id)}>View Report</Button>
                                        </td>
                                    </tr>
                                ))
                            }
                        </Table>
                    </Card>
                </div>
            )}
        </Card>
    );
}

export default DashboardView;