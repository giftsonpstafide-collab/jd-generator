/**
 * RecruitIntel - App Controller
 * Manages form handling, Gemini API integration, mock generations, history logging, and theme toggling.
 */

document.addEventListener('DOMContentLoaded', () => {
    // STATE MANAGEMENT
    const state = {
        apiKey: localStorage.getItem('gemini_api_key') || '',
        model: localStorage.getItem('gemini_model') || 'gemini-2.5-flash',
        mockFallback: localStorage.getItem('gemini_mock_fallback') !== 'false', // default true
        systemInstruction: localStorage.getItem('gemini_system_instruction') || '',
        theme: localStorage.getItem('theme') || 'dark',
        currentMarkdown: '',
        history: JSON.parse(localStorage.getItem('generation_history')) || [],
        activeTab: 'tab-rendered'
    };

    // DOM ELEMENTS
    const elements = {
        themeToggle: document.getElementById('btn-theme-toggle'),
        openSettings: document.getElementById('btn-open-settings'),
        apiStatusBadge: document.getElementById('api-status-badge'),
        
        // Form
        form: document.getElementById('jd-form'),
        inputRole: document.getElementById('input-role'),
        inputLocation: document.getElementById('input-location'),
        inputContract: document.getElementById('input-contract'),
        selectTemplate: document.getElementById('select-template'),
        inputRawJd: document.getElementById('input-raw-jd'),
        charCount: document.getElementById('jd-char-count'),
        btnLoadSample: document.getElementById('btn-load-sample'),
        btnGenerate: document.getElementById('btn-generate'),
        btnLoader: document.querySelector('.btn-loader'),
        btnText: document.querySelector('.btn-text'),
        
        // Output Panels
        outputEmptyState: document.getElementById('output-empty-state'),
        renderedContainer: document.getElementById('rendered-output-container'),
        markdownContainer: document.getElementById('markdown-output-container'),
        editableTextarea: document.getElementById('editable-output-textarea'),
        loadingOverlay: document.getElementById('loading-overlay'),
        loaderTitle: document.getElementById('loader-status-title'),
        loaderDesc: document.getElementById('loader-status-desc'),
        progressFill: document.getElementById('progress-fill'),
        
        // Output Tabs & Actions
        tabTriggers: document.querySelectorAll('.tab-trigger'),
        tabContents: document.querySelectorAll('.tab-content'),
        btnCopy: document.getElementById('btn-copy'),
        btnDownload: document.getElementById('btn-download'),
        btnPrint: document.getElementById('btn-print'),
        
        // Sidebar History
        historyList: document.getElementById('history-list'),
        historyEmpty: document.getElementById('history-empty'),
        btnClearHistory: document.getElementById('btn-clear-history'),
        
        // Settings Modal
        settingsModal: document.getElementById('settings-modal'),
        settingsApiKey: document.getElementById('settings-api-key'),
        settingsModel: document.getElementById('settings-model'),
        settingsMockFallback: document.getElementById('settings-mock-fallback'),
        btnToggleKeyVis: document.getElementById('btn-toggle-key-visibility'),
        advancedSettingsToggle: document.getElementById('advanced-settings-toggle'),
        advancedSettingsPanel: document.getElementById('advanced-settings-panel'),
        settingsSystemInstruction: document.getElementById('settings-system-instruction'),
        btnCancelSettings: document.getElementById('btn-cancel-settings'),
        btnSaveSettings: document.getElementById('btn-save-settings'),
        btnCloseModal: document.getElementById('btn-close-modal'),
        
        // Toast
        toast: document.getElementById('toast'),
        toastIcon: document.getElementById('toast-icon'),
        toastMessage: document.getElementById('toast-message')
    };

    // SAMPLE JOB DESCRIPTIONS
    const SAMPLE_JDS = {
        role: "Senior Full-Stack Engineer",
        location: "Hybrid - London, UK",
        contract: "Permanent Full-time",
        jd: `We are looking for a Senior Full-Stack Engineer to join our growing Product Development team. You will be responsible for building, scaling, and maintaining our customer-facing web application and backend microservices.

Key Responsibilities:
* Design and implement high-performance, robust client-side interfaces using React and TypeScript.
* Develop secure, scalable API endpoints and services in Node.js / Express.
* Design database schemas, write optimized SQL queries, and manage Postgres databases.
* Write comprehensive unit, integration, and end-to-end tests (Jest, Playwright).
* Collaborate with Product Managers, UX Designers, and QA Engineers to deliver features in Agile sprints.
* Mentor junior developers and participate in code reviews.

Requirements:
* 5+ years of software engineering experience building production-grade SaaS products.
* Deep knowledge of modern Javascript, ES6+, TypeScript, React, HTML5, CSS3.
* Strong backend engineering experience using Node.js and SQL/NoSQL databases.
* Experience with cloud platforms (AWS preferred, RDS, ECS, Lambda) and Docker.
* Solid understanding of REST APIs, web security fundamentals (OWASP), and CI/CD pipelines.
* Excellent communication skills and a strong desire to collaborate.`
    };

    // INITIALIZATION
    function init() {
        // Theme initialization
        document.documentElement.setAttribute('data-theme', state.theme);
        updateThemeIcon();
        
        // API key initialization & badge update
        settingsModalInit();
        updateApiBadge();
        
        // Render history list
        renderHistory();
        
        // Event Listeners
        elements.themeToggle.addEventListener('click', toggleTheme);
        elements.openSettings.addEventListener('click', openSettingsModal);
        elements.btnCloseModal.addEventListener('click', closeSettingsModal);
        elements.btnCancelSettings.addEventListener('click', closeSettingsModal);
        elements.btnSaveSettings.addEventListener('click', saveSettings);
        elements.btnToggleKeyVis.addEventListener('click', toggleKeyVisibility);
        elements.advancedSettingsToggle.addEventListener('click', toggleAdvancedSettings);
        
        elements.btnLoadSample.addEventListener('click', loadSampleData);
        elements.inputRawJd.addEventListener('input', handleJdInput);
        elements.form.addEventListener('submit', handleFormSubmit);
        
        // Output actions
        elements.btnCopy.addEventListener('click', copyToClipboard);
        elements.btnDownload.addEventListener('click', downloadMarkdownFile);
        elements.btnPrint.addEventListener('click', () => window.print());
        
        // Synchronize textarea edits back to Markdown and Rendered containers
        elements.editableTextarea.addEventListener('input', handleEditorInput);
        
        // History actions
        elements.btnClearHistory.addEventListener('click', clearHistory);
        
        // Set up tab triggering
        elements.tabTriggers.forEach(trigger => {
            trigger.addEventListener('click', () => {
                switchTab(trigger.getAttribute('data-tab'));
            });
        });
        
        // Setup initial text char counts
        handleJdInput();
    }

    // THEME HANDLING
    function toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('theme', state.theme);
        updateThemeIcon();
        showToast(`Switched to ${state.theme} mode`, 'success');
    }

    function updateThemeIcon() {
        const icon = elements.themeToggle.querySelector('i');
        if (state.theme === 'light') {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    }

    // SETTINGS MODAL HANDLING
    function settingsModalInit() {
        elements.settingsApiKey.value = state.apiKey;
        elements.settingsModel.value = state.model;
        elements.settingsMockFallback.checked = state.mockFallback;
        elements.settingsSystemInstruction.value = state.systemInstruction;
    }

    function updateApiBadge() {
        if (state.apiKey) {
            elements.apiStatusBadge.textContent = "Gemini Active";
            elements.apiStatusBadge.className = "btn-badge configured";
            elements.openSettings.classList.remove('primary-pulse');
        } else {
            elements.apiStatusBadge.textContent = "Setup Required";
            elements.apiStatusBadge.className = "btn-badge";
            elements.openSettings.classList.add('primary-pulse');
        }
    }

    function openSettingsModal() {
        settingsModalInit();
        elements.settingsModal.classList.remove('hidden');
    }

    function closeSettingsModal() {
        elements.settingsModal.classList.add('hidden');
    }

    function toggleKeyVisibility() {
        const input = elements.settingsApiKey;
        const icon = elements.btnToggleKeyVis.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fa-solid fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fa-solid fa-eye';
        }
    }

    function toggleAdvancedSettings() {
        elements.advancedSettingsToggle.classList.toggle('open');
        elements.advancedSettingsPanel.classList.toggle('hidden');
    }

    function saveSettings() {
        state.apiKey = elements.settingsApiKey.value.trim();
        state.model = elements.settingsModel.value;
        state.mockFallback = elements.settingsMockFallback.checked;
        state.systemInstruction = elements.settingsSystemInstruction.value.trim();
        
        localStorage.setItem('gemini_api_key', state.apiKey);
        localStorage.setItem('gemini_model', state.model);
        localStorage.setItem('gemini_mock_fallback', state.mockFallback);
        localStorage.setItem('gemini_system_instruction', state.systemInstruction);
        
        updateApiBadge();
        closeSettingsModal();
        showToast("Gemini configurations saved successfully!", "success");
    }

    // FORM & CONTENT HANDLING
    function loadSampleData() {
        elements.inputRole.value = SAMPLE_JDS.role;
        elements.inputLocation.value = SAMPLE_JDS.location;
        elements.inputContract.value = SAMPLE_JDS.contract;
        elements.inputRawJd.value = SAMPLE_JDS.jd;
        handleJdInput();
        showToast("Sample data loaded. Click 'Generate Recruiter Map' next!", "info");
    }

    function handleJdInput() {
        const count = elements.inputRawJd.value.length;
        elements.charCount.textContent = `${count.toLocaleString()} characters`;
    }

    // TABS HANDLING
    function switchTab(tabId) {
        state.activeTab = tabId;
        elements.tabTriggers.forEach(t => {
            if (t.getAttribute('data-tab') === tabId) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        
        elements.tabContents.forEach(c => {
            if (c.id === tabId) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
    }

    function handleEditorInput() {
        const mdText = elements.editableTextarea.value;
        state.currentMarkdown = mdText;
        elements.markdownContainer.textContent = mdText;
        
        // Render Markdown using marked.js
        if (window.marked) {
            elements.renderedContainer.innerHTML = window.marked.parse(mdText);
        } else {
            elements.renderedContainer.innerHTML = `<pre>${mdText}</pre>`;
        }
    }

    // NOTIFICATION TOAST
    function showToast(message, type = 'info') {
        elements.toastMessage.textContent = message;
        elements.toast.className = 'toast'; // reset classes
        
        if (type === 'error') {
            elements.toast.classList.add('toast-error');
            elements.toastIcon.className = 'fa-solid fa-circle-exclamation';
        } else if (type === 'success') {
            elements.toast.classList.add('toast-success');
            elements.toastIcon.className = 'fa-solid fa-circle-check';
        } else {
            elements.toastIcon.className = 'fa-solid fa-circle-info';
        }
        
        elements.toast.classList.remove('hidden');
        
        // Clear previous timeout if any
        if (window.toastTimeout) clearTimeout(window.toastTimeout);
        
        window.toastTimeout = setTimeout(() => {
            elements.toast.classList.add('hidden');
        }, 4000);
    }

    // EXPORT FUNCTIONS
    function copyToClipboard() {
        if (!state.currentMarkdown) {
            showToast("No content to copy!", "error");
            return;
        }
        
        navigator.clipboard.writeText(state.currentMarkdown)
            .then(() => {
                showToast("Markdown copied to clipboard!", "success");
            })
            .catch(err => {
                showToast("Failed to copy content.", "error");
                console.error(err);
            });
    }

    function downloadMarkdownFile() {
        if (!state.currentMarkdown) {
            showToast("No content to download!", "error");
            return;
        }
        
        const roleName = elements.inputRole.value.trim() || 'internal_recruitment_strategy';
        const fileName = `${roleName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_recruitment_map.md`;
        
        const blob = new Blob([state.currentMarkdown], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast(`Downloaded ${fileName}`, "success");
    }

    // FORM SUBMISSION & GENERATION MACHINE
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const role = elements.inputRole.value.trim();
        const location = elements.inputLocation.value.trim();
        const contract = elements.inputContract.value.trim();
        const rawJd = elements.inputRawJd.value.trim();
        const template = elements.selectTemplate.value;
        
        if (!rawJd) {
            showToast("Original Job Description or raw notes are required!", "error");
            elements.inputRawJd.focus();
            return;
        }
        
        // Enable loaders
        elements.btnGenerate.disabled = true;
        elements.btnLoader.classList.remove('hidden');
        elements.btnText.textContent = "Processing...";
        elements.outputEmptyState.classList.add('hidden');
        elements.loadingOverlay.classList.remove('hidden');
        
        // Reset loader elements
        resetLoadingAnimation();
        
        try {
            let markdownResult = '';
            
            if (state.apiKey) {
                // RUN GEMINI
                markdownResult = await runGeminiGeneration(role, location, contract, rawJd, template);
            } else {
                // MOCK fallback check
                if (state.mockFallback) {
                    markdownResult = await runMockGeneration(role, location, contract, template);
                } else {
                    throw new Error("No API Key configured. Please go to Settings (gear icon) to input your key, or enable Fallback Mock Mode.");
                }
            }
            
            // Set results to UI
            state.currentMarkdown = markdownResult;
            elements.markdownContainer.textContent = markdownResult;
            elements.editableTextarea.value = markdownResult;
            
            if (window.marked) {
                elements.renderedContainer.innerHTML = window.marked.parse(markdownResult);
            } else {
                elements.renderedContainer.innerHTML = `<pre>${markdownResult}</pre>`;
            }
            
            // Push to history
            addToHistory(role || "Untitled Role", template, markdownResult);
            
            // Open Strategy tab
            switchTab('tab-rendered');
            showToast("Strategy map successfully generated!", "success");
            
        } catch (error) {
            console.error("Generation failed:", error);
            showToast(error.message, "error");
            // If no previous run, show empty state again
            if (!state.currentMarkdown) {
                elements.outputEmptyState.classList.remove('hidden');
            }
        } finally {
            // Restore buttons
            elements.btnGenerate.disabled = false;
            elements.btnLoader.classList.add('hidden');
            elements.btnText.textContent = "Generate Recruiter Map";
            elements.loadingOverlay.classList.add('hidden');
        }
    }

    // LOADING OVERLAY SIMULATOR
    function resetLoadingAnimation() {
        elements.progressFill.style.width = '0%';
        const steps = elements.loadingOverlay.querySelectorAll('.loader-step');
        steps.forEach((step, idx) => {
            if (idx === 0) {
                step.className = 'loader-step active';
                step.querySelector('i').className = 'fa-solid fa-circle-notch fa-spin';
            } else {
                step.className = 'loader-step';
                step.querySelector('i').className = 'fa-regular fa-circle';
            }
        });
    }

    async function simulateLoadingSteps() {
        const steps = [
            { text: "Standardizing Intake Profile", time: 700 },
            { text: "Formulating target candidate criteria", time: 1000 },
            { text: "Drafting Boolean search strings", time: 1000 },
            { text: "Designing screening interview questions", time: 800 }
        ];
        
        let progress = 0;
        
        for (let i = 0; i < steps.length; i++) {
            elements.loaderTitle.textContent = steps[i].text;
            elements.loaderDesc = `Step ${i+1} of 4: Conducting intelligence analysis...`;
            
            // Mark current active
            const currentStepEl = document.getElementById(`step-${i + 1}`);
            if (currentStepEl) {
                currentStepEl.className = 'loader-step active';
                currentStepEl.querySelector('i').className = 'fa-solid fa-circle-notch fa-spin';
            }
            
            // Delay
            await new Promise(resolve => setTimeout(resolve, steps[i].time));
            
            // Mark completed
            if (currentStepEl) {
                currentStepEl.className = 'loader-step completed';
                currentStepEl.querySelector('i').className = 'fa-solid fa-circle-check';
            }
            
            progress += 25;
            elements.progressFill.style.width = `${progress}%`;
        }
    }

    // REAL GEMINI API CALL
    async function runGeminiGeneration(role, location, contract, rawJd, template) {
        const progressPromise = simulateLoadingSteps();
        
        // Construct detailed prompts
        const systemPrompt = `You are a world-class executive recruiter, talent sourcer, and tech hiring consultant. 
Your goal is to parse raw, candidate-facing Job Descriptions or intake notes and convert them into a highly strategic internal guide for recruiters.
${state.systemInstruction ? `Follow these custom directives: ${state.systemInstruction}` : ''}`;

        let templateGuidePrompt = '';
        if (template === 'sourcing-map') {
            templateGuidePrompt = `Generate a COMPLETE RECRUITER STRATEGY MAP in markdown. It MUST follow this structure:
# Recruitment Strategy Map: [Role Name]
## 1. Candidate Persona & Background Context
* Provide an internal description of the perfect candidate background. Which industries/competitor sectors should we target? What is their likely career path?
## 2. Capability Matrix (Table Format)
* Create a table dividing skills into:
  - Technical / Hard Skills (Must-Have vs. Nice-to-Have, and how to verify them)
  - Core Competencies / Soft Skills (Must-Have vs. Nice-to-Have)
## 3. Sourcing Strategy & Boolean Queries
* Write exact Boolean Search Strings for:
  - LinkedIn Recruiter (Title & Keyword combination)
  - GitHub / Google X-Ray Search (e.g., locating resumes or portfolios)
* List 3 specific sourcing channels, communities, or platforms where these candidates congregate.
## 4. Cold Outreach InMail Templates
* Write a short, highly response-optimized cold outreach template (max 150 words) that recruiters can use on LinkedIn or email. Emphasize a "hook" and a light call to action. Include bracketed placeholders (e.g. [Candidate Name], [Company]).`;
        } else if (template === 'screening-rubric') {
            templateGuidePrompt = `Generate a STRUCTURED INTERVIEW RUBRIC in markdown. It MUST follow this structure:
# Recruiter Screening Rubric: [Role Name]
## 1. Initial 15-Minute Recruiter Screen (Questions & Listen For)
* Provide 4 structured, open-ended questions designed to gauge foundational experience, salary alignment, contract/location constraints, and notice periods.
* For each question, specify a detailed "Listen For" subsection with indicators of strong vs. weak answers.
## 2. Hard Skills Qualification Screen
* Provide 3 technical/role-specific screening questions (not coding tests, but concept checking) to ensure they aren't fluffing their resume.
* Include detailed expected answers/responses.
## 3. Behavioral/Soft Skills Rubric
* Outline evaluation guidelines for communication clarity, collaboration style, and growth mindset.
## 4. Critical Red Flags
* List 4 major red flags specific to this role (e.g. tool-chasing, lack of core understanding, tenure issues, etc.).`;
        } else {
            templateGuidePrompt = `Generate a LEVELING & INTERNAL JD ALIGNMENT in markdown. It MUST follow this structure:
# Internal JD Alignment & Leveling Map: [Role Name]
## 1. Leveling & Compensation Band Positioning
* Based on the responsibilities, classify the logical seniority level (e.g., Junior, Mid, Senior, Lead, Staff) and define what scope of autonomy is expected (e.g., individual tasks, small projects, system-wide decisions).
## 2. Key Stakeholders & Interdependencies
* Describe the internal structure. Who are the direct stakeholders they will work with daily? Who does this role support, and who supports them?
## 3. 30-60-90 Day Success KPIs
* Define realistic, measurable success milestones for:
  - First 30 Days (Onboarding, tooling, initial codebase/workspace grasp)
  - 60 Days (First standalone contributions, peer feedback)
  - 90 Days (Complete ownership of features, driving discussions)
## 4. Cleaned Up Internal JD Details
* Translate the client's messy bullet points into 5-6 standardized internal responsibilities and 5-6 core requirements. Ready to be uploaded to HR systems.`;
        }

        const userPrompt = `Target Role Details:
- Role Title: ${role || 'Not Specified (Extract from JD)'}
- Target Location: ${location || 'Not Specified'}
- Contract Type: ${contract || 'Not Specified'}
- Target Template Style: ${template}

Original JD / Intake Notes:
"""
${rawJd}
"""

Instructions: Use the guidelines and generate the response. Output markdown only. Do not include markdown code fence block indicators (\`\`\`) in the beginning or end of your overall response text, just start directly with the markdown content. Make it detailed, highly professional, and ready to act upon.`;

        const requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: systemPrompt },
                        { text: templateGuidePrompt },
                        { text: userPrompt }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2500
            }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:generateContent?key=${state.apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        // Wait for prompt rendering simulation to finish
        await progressPromise;

        if (!response.ok) {
            const errorJson = await response.json().catch(() => ({}));
            const errorMessage = errorJson?.error?.message || `HTTP error! status: ${response.status}`;
            throw new Error(`Gemini API Error: ${errorMessage}`);
        }

        const responseData = await response.json();
        const generatedText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            throw new Error("Invalid API response format. Check your API key or model availability.");
        }

        return cleanMarkdownResponse(generatedText);
    }

    // Helper to clean up backticks from the API output if it wraps it in markdown code block
    function cleanMarkdownResponse(text) {
        let cleaned = text.trim();
        if (cleaned.startsWith('```markdown')) {
            cleaned = cleaned.substring(11);
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.substring(0, cleaned.length - 3);
        }
        return cleaned.trim();
    }

    // MOCK GENERATOR (Runs offline/when API key is empty)
    async function runMockGeneration(role, location, contract, template) {
        // Run progress animation
        await simulateLoadingSteps();
        
        const finalRole = role || "Senior Software Engineer";
        const finalLocation = location || "Hybrid / Remote";
        const finalContract = contract || "Permanent";
        
        // Define some keywords based on role input to make mock realistic
        const isTech = /engineer|dev|code|tech|architect|programmer|data|react|node|cloud|qa/i.test(finalRole);
        const isDesign = /design|product designer|ui|ux|creative/i.test(finalRole);
        const isProduct = /product manager|pm|scrum|owner/i.test(finalRole);
        
        let skillsTable = '';
        let booleanSearch = '';
        let outreachMsg = '';
        let screeningQuestions = '';
        let redFlags = '';
        let levelDescription = '';
        let kpis = '';
        let responsibilitiesList = '';
        
        if (isTech) {
            skillsTable = `
| Skill Category | Must-Have (Critical) | Nice-to-Have (Pluses) | Verification Method |
| :--- | :--- | :--- | :--- |
| **Languages** | Modern Javascript, ES6+, TypeScript | Python, Go, Rust | Technical review & code sample |
| **Frameworks** | React, Node.js (Express), SQL databases | Next.js, GraphQL, PostgreSQL | Deep dive architectural discussion |
| **Cloud/Infrastructure** | Git workflows, AWS basics, Docker | CI/CD pipelines, Kubernetes, Serverless | Review of previous deployment ownership |
| **Engineering Practices**| Unit/Integration Testing (Jest) | E2E Testing, OWASP Security focus | Scenario review on debugging |
`;
            booleanSearch = `
* **LinkedIn Recruiter (Target Search String):**
  \`(TypeScript OR React) AND "Node.js" AND (Postgres OR SQL) AND "Senior" AND (SaaS OR Microservices)\`
* **Google X-Ray (Sourcing GitHub/Resumes):**
  \`site:github.com "Senior Full-Stack Engineer" "London" "React" (cv OR resume OR "sourcing map")\`
`;
            outreachMsg = `
Subject: Colleague reference / Building modern full-stack systems at RecruitIntel?

Hi [Candidate Name],

I was reviewing your GitHub portfolio and LinkedIn profile and noticed your deep experience scaling Node/React systems, particularly your work at [Candidate's Current Company]. 

We are expanding our core team here and are looking for a Senior Full-Stack Engineer who can own our product microservices. Knowing your background with TypeScript, I thought you'd be a great person to discuss this with.

Would you be open to a casual 15-minute sync this Thursday at 2:00 PM to talk about what we're building? 

Best regards,
[Your Name]
Recruiting Lead, RecruitIntel
`;
            screeningQuestions = `
1. **"Can you walk me through an architectural challenge you faced when scaling a React/Node microservice? What choices did you make, and what would you do differently today?"**
   * *Listen For (Strong)*: Clear trade-off analysis (e.g. latency vs. maintainability), ownership of mistakes, understanding of data consistency.
   * *Listen For (Weak)*: Memorized definitions, tool-chasing without explaining why.
2. **"How do you approach debugging a memory leak or database performance bottleneck in a Node environment?"**
   * *Listen For (Strong)*: Structured logging, profiling tools (APM), execution plans (EXPLAIN), connection pools.
   * *Listen For (Weak)*: "I'd restart the server," vague troubleshooting steps.
3. **"Explain how you handle asynchronous state management in a complex React UI client?"**
   * *Listen For (Strong)*: Knowing when to use local vs. global state, caching strategies (React Query/RTK), handling side effects.
4. **"What is your expectation for code quality reviews, and how do you mentor junior developers?"**
   * *Listen For (Strong)*: Constructive PR comments, pairing sessions, focusing on learning rather than criticizing.
`;
            redFlags = `
* **Over-engineering complex solutions**: Prefers deploying microservices or Kubernetes for simple internal CRUD apps.
* **Lack of product empathy**: Views engineering tasks purely as specifications rather than understanding the customer outcome.
* **Resume keyword stuffing**: Fails to explain the depth of standard React patterns or Node concurrency despite listing them.
* **Low tenure patterns**: Multiple moves within 6-12 months without clear external explanations.
`;
            levelDescription = `
* **Target Grade**: Senior Engineer (IC4 / Lead Track)
* **Autonomy Level**: High. The candidate is expected to pick up complex, loosely defined features, coordinate with PMs/Designers, and deliver them start-to-finish without direct handholding.
* **Technical Scope**: Responsible for system-wide performance in their feature area, contributing to structural architecture discussions.
`;
            kpis = `
* **30 Days**: Complete system onboarding, deploy 2 small fixes to production, and understand our database schema.
* **60 Days**: Lead the implementation of a medium-sized feature, run 3 code reviews for peers, and establish unit testing coverage.
* **90 Days**: Own a major product epic, coordinate deployment strategies, and identify 1 system improvement to optimize DB queries.
`;
            responsibilitiesList = `
* Own end-to-end full-stack feature development using React, Node.js, and TypeScript.
* Design robust, scaleable RESTful APIs and optimized SQL database schemas.
* Conduct constructve PR code reviews and mentor engineers on programming best-practices.
* Implement CI/CD improvements and monitor app health through telemetry tools.
* Coordinate closely with Product Managers to align code features with client goals.
`;
        } else if (isDesign) {
            skillsTable = `
| Skill Category | Must-Have (Critical) | Nice-to-Have (Pluses) | Verification Method |
| :--- | :--- | :--- | :--- |
| **UI/UX Design** | Figma, Interactive Prototyping, Design Systems | Motion graphics, illustration | Portfolio review (case study breakdown) |
| **Research** | Usability Testing, Interviewing, Wireframing | SQL knowledge, UserTesting.com | Discussion on user feedback loops |
| **Frontend Basics** | HTML5, CSS layout principles (Flexbox/Grid) | React basics, Tailwind, CSS variables | Discussion on developer handoff |
`;
            booleanSearch = `
* **LinkedIn Recruiter:** \`"Product Designer" AND "Figma" AND "Design System" AND "Senior" AND (SaaS OR B2B)\`
`;
            outreachMsg = `
Subject: Your design portfolio caught my eye

Hi [Candidate Name],

I came across your design portfolio, particularly your case study on simplifying complex dashboard workflows. The visual polish and attention to UX friction points was impressive.

We're currently scaling our designer team here and are looking for a Senior Product Designer to own the core user experience. Given your expertise in design systems and Figma layouts, I felt there might be a strong alignment.

Do you have 10 minutes for a quick chat this week?

Best,
[Your Name]
`;
            screeningQuestions = `
1. **"Can you walk me through a design decision you made that was heavily influenced by user feedback or usability testing?"**
   * *Listen For (Strong)*: Willingness to change designs, quantitative/qualitative data combination.
   * *Listen For (Weak)*: Defensive behavior about their design preferences.
2. **"How do you maintain consistency when building and documenting components in Figma?"**
   * *Listen For (Strong)*: Auto-layout mastery, component properties, token design alignment.
`;
            redFlags = `
* **Lack of business metrics alignment**: Focuses on beautiful visual design shots without explaining the user conversion/retention impact.
* **Friction with developers**: Standardizes component UI library styles without consulting developer feasibility constraints.
`;
            levelDescription = `
* **Target Grade**: Senior Product Designer (IC4)
* **Autonomy Level**: Lead initiatives. Coordinates user research, executes design systems, and manages design reviews independently.
`;
            kpis = `
* **30 Days**: Understand customer personas, review current components, and deliver 1 design improvement.
* **60 Days**: Conduct user testing sessions, map friction areas, and publish interactive design prototypes.
* **90 Days**: Define UX roadmap for the core team, present design specs to dev teams, and align style libraries.
`;
            responsibilitiesList = `
* Lead user-centric designs for core web/mobile workspaces using Figma.
* Conduct user interviews and usability analysis to identify core friction issues.
* Document and expand the components in the global Design System.
* Partner with Product and Engineering to ensure smooth developer handoffs.
`;
        } else {
            // General / Product Manager / Other roles
            skillsTable = `
| Skill Category | Must-Have (Critical) | Nice-to-Have (Pluses) | Verification Method |
| :--- | :--- | :--- | :--- |
| **Domain Focus** | Stakeholder management, Roadmap definition | Technical degree, Agile/Scrum certification| Experience review on lifecycle delivery |
| **Analytics** | SQL, Amplitude / Mixpanel, Excel modeling | Python, dashboard automation | Case study on metric definition |
| **Soft Skills** | Clear communication, conflict resolution | Public speaking, client management | Scenario interview |
`;
            booleanSearch = `
* **LinkedIn Recruiter:** \`("Product Manager" OR "PM") AND ("Roadmap" OR "PRD") AND "Senior" AND (SaaS OR Product)\`
`;
            outreachMsg = `
Subject: Product strategy at RecruitIntel

Hi [Candidate Name],

Your background managing complex product lifecycles at [Candidate's Current Company] stood out. We are looking for a Senior Product Manager to drive roadmap execution for our recruitment intelligence system.

Given your metrics-driven approach to feature delivery, I thought you'd be a perfect person to brainstorm with.

Let me know if you are open to a short call.

Best,
[Your Name]
`;
            screeningQuestions = `
1. **"How do you say 'no' to high-priority features suggested by major customers or internal executives without damaging relationships?"**
   * *Listen For (Strong)*: Data-backed priority models, customer-problem orientation, transparent alignment.
   * *Listen For (Weak)*: Passive-aggressive acceptance, saying yes to everything.
`;
 redFlags = `
* **Lack of technical/data depth**: Inability to write simple queries or analyze product telemetry without developer assistance.
* **Feature-factory orientation**: Focuses on shipping speed rather than measuring actual customer adoption.
`;
            levelDescription = `
* **Target Grade**: Senior Product Manager (IC4)
* **Autonomy Level**: Full product line ownership. Identifies customer challenges, aligns team velocity, and reports key outcome metrics.
`;
            kpis = `
* **30 Days**: Build strong relationships with core devs, map out current customer issues, and review backlog.
* **60 Days**: Write 2 detailed PRDs, align team on sprint milestones, and launch 1 feature test.
* **90 Days**: Present a 6-month product roadmap, define key quarterly KPIs, and increase metric adoption.
`;
            responsibilitiesList = `
* Define and execute the product roadmap for our core applications.
* Collaborate with engineering, UX design, and sales teams to ship high-impact features.
* Analyze user telemetry and research findings to guide prioritizations.
* Document detailed Product Requirement Documents (PRDs) and user stories.
`;
        }

        let outputContent = '';

        if (template === 'sourcing-map') {
            outputContent = `# Recruitment Strategy Map: ${finalRole}
> **Target Alignment**: ${finalLocation} | ${finalContract} | Standard Strategy Template

## 1. Candidate Persona & Background Context
We are looking for an experienced professional to join our team as a **${finalRole}**. The ideal candidate has spent the last 3-5 years scaling production systems in high-growth environments, preferably in modern SaaS, Fintech, or B2B enterprise sectors. 

They should demonstrate a career trajectory showing progression from executing structured tickets to designing feature components independently. We should target talent coming from mid-sized scaling companies where they had high ownership, rather than massive companies (where scope is highly segmented) or early-stage startups (where practices may be too chaotic).

## 2. Capability Matrix
${skillsTable}

## 3. Sourcing Strategy & Boolean Queries
To locate high-caliber passive candidates, talent sourcers should run the following queries:

### Boolean Search Queries
${booleanSearch}

### Sourcing Channels & Target Pools
1. **Premium Talent Pools**: Sourcing directly on GitHub/Figma portfolios, seeking candidate contact information via personal developer domains.
2. **Industry Networks**: Targeting specialized tech communities, local user groups, and developer meetups (e.g. React London, UX design groups).
3. **Target Companies**: Mid-sized tech companies, software consultancies with strong engineering reputations, and scaling product startups.

## 4. Cold Outreach InMail Templates
Use the following response-optimized outreach copy for LinkedIn or direct email. Keep the message personalized and focused on alignment.

### Candidate Outreach Template
${outreachMsg}
`;
        } else if (template === 'screening-rubric') {
            outputContent = `# Recruiter Screening Rubric: ${finalRole}
> **Target Alignment**: ${finalLocation} | ${finalContract} | Standard Interview Template

## 1. Initial 15-Minute Recruiter Screen (Intake Assessment)
Use these questions to establish baseline fit during the initial phone screen.

${screeningQuestions}

## 2. Behavioral/Soft Skills Rubric
Evaluate the candidate's responses against these core values during the screening conversation.

| Core Competency | Strong Indicators | Warning Indicators |
| :--- | :--- | :--- |
| **Communication Clarity** | Explains complex topics simply; doesn't ramble; actively listens. | Struggles to summarize experience; uses excessive buzzwords. |
| **Collaboration Style** | Uses "we" instead of "I" when talking about team success; values feedback. | Takes sole credit for team results; criticizes previous coworkers. |
| **Growth Mindset** | Discusses books, personal projects, or learning from failures openly. | Believes their way is the only way; resistant to change. |

## 3. Critical Red Flags
During the screen, watch out for the following warning signs:
${redFlags}

## 4. Screening Evaluation Matrix
Score candidate suitability from 1 to 5 based on the overall intake alignment.

* **Score 5 (Strong Hire)**: Meets all must-have skills, demonstrates clear cultural alignment, strong communications, immediately send to panel.
* **Score 3 (Borderline)**: Meets must-have requirements but lacks secondary skills. Marginal communication or slight domain gap. Needs internal hiring manager review.
* **Score 1 (Reject)**: Severe lack of core competencies, active red flags, or salary/location expectations outside budget limits.
`;
        } else {
            outputContent = `# Internal JD Alignment & Leveling Map: ${finalRole}
> **Target Alignment**: ${finalLocation} | ${finalContract} | Leveling Template

## 1. Leveling & Compensation Band Positioning
${levelDescription}

## 2. Key Stakeholders & Interdependencies
The candidate in this role will operate within a collaborative team structure:
* **Reports To**: Engineering Manager / Product Director.
* **Daily Collaborators**: Product Managers, UI/UX Designers, QA Engineers, and engineering peers.
* **External Alignment**: May occasionally interact with Client Success leads to troubleshoot customer friction items.

## 3. 30-60-90 Day Success KPIs
To facilitate smooth onboarding and ensure early contribution, track the candidate against these milestones:
${kpis}

## 4. Cleaned Up Internal JD Details
Use the details below to upload the job listing to applicant tracking systems (ATS) or HR portals.

### Standardized Internal Responsibilities
${responsibilitiesList}

### Standardized Requirements
* Bachelor’s degree in Computer Science, Design, Business, or equivalent practical industry experience (5+ years).
* Demonstrated experience shipping core software, designs, or products in a SaaS/B2B context.
* Strong team-first mindset with excellent verbal and written communication skills.
* Ability to work comfortably in an Agile environment and adapt to evolving priorities.
`;
        }

        // Simulating slight delays for realism
        return outputContent;
    }

    // HISTORY MANAGEMENT
    function addToHistory(roleName, templateType, markdownContent) {
        const timestamp = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let displayTemplate = 'Recruiter Strategy';
        if (templateType === 'screening-rubric') displayTemplate = 'Screening Rubric';
        if (templateType === 'internal-alignment') displayTemplate = 'Internal Leveling';
        
        const newItem = {
            id: Date.now().toString(),
            role: roleName,
            template: templateType,
            displayTemplate: displayTemplate,
            date: timestamp,
            markdown: markdownContent
        };
        
        // Unshift to list (newest first)
        state.history.unshift(newItem);
        
        // Limit to 10 items
        if (state.history.length > 10) {
            state.history.pop();
        }
        
        localStorage.setItem('generation_history', JSON.stringify(state.history));
        renderHistory();
    }

    function renderHistory() {
        elements.historyList.innerHTML = '';
        
        if (state.history.length === 0) {
            elements.historyEmpty.classList.remove('hidden');
            elements.btnClearHistory.style.display = 'none';
            return;
        }
        
        elements.historyEmpty.classList.add('hidden');
        elements.btnClearHistory.style.display = 'block';
        
        state.history.forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.dataset.id = item.id;
            
            li.innerHTML = `
                <div class="history-item-header">
                    <div class="history-item-title" title="${item.role}">${item.role}</div>
                    <div class="history-item-date">${item.date}</div>
                </div>
                <div class="history-item-tags">
                    <span class="history-tag">${item.displayTemplate}</span>
                </div>
            `;
            
            li.addEventListener('click', () => loadHistoryItem(item.id));
            elements.historyList.appendChild(li);
        });
    }

    function loadHistoryItem(id) {
        const item = state.history.find(h => h.id === id);
        if (!item) return;
        
        state.currentMarkdown = item.markdown;
        elements.markdownContainer.textContent = item.markdown;
        elements.editableTextarea.value = item.markdown;
        
        if (window.marked) {
            elements.renderedContainer.innerHTML = window.marked.parse(item.markdown);
        } else {
            elements.renderedContainer.innerHTML = `<pre>${item.markdown}</pre>`;
        }
        
        // Update form values
        elements.inputRole.value = item.role;
        elements.selectTemplate.value = item.template;
        
        elements.outputEmptyState.classList.add('hidden');
        switchTab('tab-rendered');
        showToast(`Loaded "${item.role}" recruitment map from history`, "success");
    }

    function clearHistory() {
        if (confirm("Are you sure you want to clear all history logs?")) {
            state.history = [];
            localStorage.removeItem('generation_history');
            renderHistory();
            showToast("History log cleared.", "info");
        }
    }

    // Run app
    init();
});
