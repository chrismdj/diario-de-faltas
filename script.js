// ---------- CONFIGURAÇÃO OBRIGATÓRIA ----------
// --- COLE AQUI A URL DO SEU WEB APP DO GOOGLE APPS SCRIPT ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbylnp-vM7YUF6h_mf9NRy_c-mwyBcWa9R2kXFfj7R7oPRFJTxFE4kS-qqcqDg4hVmN9cA/exec";
// ----------------------------------------------

// Elementos da página
const sheetSelect = document.getElementById('sheetSelect');
const dateInput = document.getElementById('callDate');
const loadButton = document.getElementById('loadButton');
const studentListElement = document.getElementById('studentList');
const loadingElement = document.getElementById('loading');
const updateStatusElement = document.getElementById('updateStatus');

// --- Funções Auxiliares ---

// Formata data de YYYY-MM-DD para DD/MM
function formatDateToDDMM(isoDate) {
    if (!isoDate) return "";
    const parts = isoDate.split('-'); // [YYYY, MM, DD]
    if (parts.length !== 3) return isoDate; // Retorna original se não for formato esperado
    return `${parts[2]}/${parts[1]}`;
}

// Mostra ou esconde o indicador de carregamento
function showLoading(isLoading) {
    loadingElement.style.display = isLoading ? 'block' : 'none';
}

// Exibe mensagens de status (sucesso ou erro)
function showStatus(message, isError = false) {
    updateStatusElement.textContent = message;
    updateStatusElement.className = 'status-message'; // Reseta classes
    if (message) {
        updateStatusElement.classList.add(isError ? 'error' : 'success');
    }
}

// --- Funções Principais ---

// Busca os dados da planilha (doGet no Apps Script)
async function loadAttendanceData() {
    const selectedSheet = sheetSelect.value;
    const selectedDateISO = dateInput.value; // Formato YYYY-MM-DD

    if (!selectedSheet) {
        showStatus("Por favor, selecione uma turma/aba.", true);
        return;
    }
    if (!selectedDateISO) {
        showStatus("Por favor, selecione uma data.", true);
        return;
    }

    const selectedDateDDMM = formatDateToDDMM(selectedDateISO);

    showLoading(true);
    showStatus(""); // Limpa status anterior
    studentListElement.innerHTML = ''; // Limpa lista antiga

    // Constrói a URL para o doGet com parâmetros
    const fetchUrl = `${SCRIPT_URL}?sheet=${encodeURIComponent(selectedSheet)}&date=${encodeURIComponent(selectedDateDDMM)}`;

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            // Tenta ler a mensagem de erro do Apps Script se houver
            let errorMsg = `Erro HTTP ${response.status}.`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.message) {
                    errorMsg += ` Detalhe: ${errorData.message}`;
                }
            } catch (e) { /* Ignora se não conseguir parsear o erro */ }
            throw new Error(errorMsg);
        }

        const data = await response.json();

        if (data.status === 'error') { // Verifica erro retornado pelo script
             throw new Error(data.message || "Erro retornado pelo script.");
        }

        renderStudentList(data.students || []); // Renderiza a lista recebida
         if (data.message) { // Mostra mensagens informativas do script (ex: data não encontrada)
             showStatus(data.message, false);
         }

    } catch (error) {
        console.error("Erro ao buscar dados:", error);
        showStatus(`Erro ao carregar dados: ${error.message}`, true);
    } finally {
        showLoading(false);
    }
}

// Renderiza a lista de alunos na tela
function renderStudentList(students) {
    studentListElement.innerHTML = ''; // Limpa a lista atual

    if (!students || students.length === 0) {
        studentListElement.innerHTML = '<li>Nenhum aluno encontrado nesta turma/aba.</li>';
        return;
    }

    students.forEach(student => {
        if (!student || !student.name) return; // Pula alunos inválidos

        const li = document.createElement('li');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = student.name;
        li.appendChild(nameSpan);

        const checkboxLabel = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = student.absent === true; // Marca se absent for TRUE
        checkbox.dataset.studentName = student.name; // Guarda o nome no checkbox para fácil acesso

        // Adiciona o listener AQUI, dentro do loop de criação
        checkbox.addEventListener('change', handleAttendanceChange);

        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(document.createTextNode(' Ausente')); // Texto ao lado
        li.appendChild(checkboxLabel);

        studentListElement.appendChild(li);
    });
}

// Lida com a mudança no estado de um checkbox (doPost no Apps Script)
async function handleAttendanceChange(event) {
    const checkbox = event.target;
    const studentName = checkbox.dataset.studentName;
    const isAbsent = checkbox.checked;
    const selectedSheet = sheetSelect.value;
    const selectedDateISO = dateInput.value;
    const selectedDateDDMM = formatDateToDDMM(selectedDateISO);

    if (!selectedSheet || !selectedDateDDMM || !studentName) {
        console.error("Faltando dados para atualizar:", { selectedSheet, selectedDateDDMM, studentName });
        showStatus("Erro interno: Não foi possível identificar os dados para atualização.", true);
        // Reverte visualmente o checkbox em caso de erro grave antes do fetch
        checkbox.checked = !isAbsent;
        return;
    }

    showStatus(`Atualizando ${studentName}...`); // Feedback instantâneo

    const payload = {
        sheet: selectedSheet,
        student: studentName,
        date: selectedDateDDMM,
        absent: isAbsent
    };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            // mode: 'no-cors', // EVITE USAR 'no-cors' se precisar ler a resposta!
            cache: 'no-cache',
             redirect: 'follow',
            // Indica que estamos enviando texto simples (o Apps Script pega via e.postData.contents)
            headers: {
                 'Content-Type': 'text/plain;charset=utf-8', // Ou application/json se o script esperar JSON
            },
            body: JSON.stringify(payload) // Envia o payload como uma string JSON
        });

        if (!response.ok) {
            let errorMsg = `Erro HTTP ${response.status} ao atualizar.`;
             try {
                 const errorData = await response.json();
                 if (errorData && errorData.message) {
                     errorMsg += ` Detalhe: ${errorData.message}`;
                 }
             } catch (e) {/* Ignora */}
             throw new Error(errorMsg);
        }

        const result = await response.json();

        if (result.status === 'success') {
            showStatus(result.message || `Status de ${studentName} atualizado com sucesso!`, false);
        } else {
             throw new Error(result.message || "Erro retornado pelo script ao atualizar.");
        }

    } catch (error) {
        console.error("Erro ao atualizar presença:", error);
        showStatus(`Erro ao atualizar ${studentName}: ${error.message}`, true);
        // Reverte a mudança visual no checkbox se a atualização falhou
        checkbox.checked = !isAbsent;
    }
}


// --- Inicialização ---

// Define a data de hoje como padrão no input date
function setDefaultDate() {
    // Usa a hora atual do Brasil (se disponível no navegador) ou UTC
    // Considera o fuso horário -03:00 (São Paulo) para definir "hoje" corretamente
    const now = new Date();
    const offset = -3 * 60; // Offset em minutos para -03:00
    const localNow = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);

    const yyyy = localNow.getFullYear();
    const mm = String(localNow.getMonth() + 1).padStart(2, '0'); // Janeiro é 0!
    const dd = String(localNow.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
}

// Adiciona os event listeners quando a página carrega
window.addEventListener('DOMContentLoaded', (event) => {
    setDefaultDate();
    loadButton.addEventListener('click', loadAttendanceData);

    // *** IMPORTANTE: Listener delegado para os checkboxes ***
    // Em vez de adicionar um listener a cada checkbox individualmente (que são criados depois),
    // adicionamos um listener à lista PAI (ul#studentList).
    // Isso já está sendo feito dentro da função renderStudentList.
    // A linha abaixo seria uma alternativa, mas adicionar ao criar é mais direto.
    // studentListElement.addEventListener('change', handleAttendanceChange);
});