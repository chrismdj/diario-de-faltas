// ---------- CONFIGURAÇÃO OBRIGATÓRIA ----------
// --- VERIFIQUE SE ESTA É A URL CORRETA DA SUA ÚLTIMA IMPLANTAÇÃO ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySPASLpUGORCyv0Dzk1ma4w4IF3O44If7XRISK24aMylAoBY-X_mbFOXMgaju25DLUCg/exec"; // <<< COLOQUE A URL CORRETA AQUI
// ----------------------------------------------

// Elementos da página
const sheetSelect = document.getElementById('sheetSelect');
const loadSheetButton = document.getElementById('loadSheetButton');
const attendanceTable = document.getElementById('attendanceTable');
const tableHead = attendanceTable.querySelector('thead');
const tableBody = attendanceTable.querySelector('tbody');
const loadingElement = document.getElementById('loading');
const updateStatusElement = document.getElementById('updateStatus');

// --- Funções Auxiliares ---
function showLoading(isLoading) {
    loadingElement.style.display = isLoading ? 'block' : 'none';
}

function showStatus(message, isError = false) {
    updateStatusElement.textContent = message;
    updateStatusElement.className = 'status-message';
    if (message) {
        updateStatusElement.classList.add(isError ? 'error' : 'success');
    }
}

// *** NOVA FUNÇÃO AUXILIAR PARA FORMATAR DATAS NO FRONTEND ***
// Tenta converter strings de data (incluindo formatos longos) para DD/MM
function formatHeaderDateToDDMM(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        // Se não for string ou for vazia, retorna como está ou vazio
        return dateString ? dateString.toString() : "";
    }
    try {
        // Verifica se já está no formato DD/MM ou DD/MM/YYYY (simplificado)
        if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(dateString.trim())) {
            // Se já parece DD/MM ou DD/MM/YYYY, retorna apenas DD/MM
            const parts = dateString.trim().split('/');
            return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
        }

        // Tenta criar um objeto Date a partir da string recebida
        // O construtor Date do JS consegue parsear muitos formatos, incluindo o longo
        const dateObj = new Date(dateString);

        // Verifica se o objeto Date criado é válido
        if (isNaN(dateObj.getTime())) {
            // Se não conseguiu parsear para uma data válida, retorna a string original
            console.warn("Não foi possível parsear a data do cabeçalho:", dateString);
            return dateString.trim(); // Retorna original (sem espaços extras)
        }

        // Se conseguiu parsear, formata para DD/MM
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Mês é 0-indexado
        console.log(`Data original: [${dateString}] -> Formatada para: ${day}/${month}`); // Log de formatação
        return `${day}/${month}`;

    } catch (e) {
        console.error("Erro ao formatar data do cabeçalho:", dateString, e);
        return dateString.trim(); // Retorna original em caso de erro inesperado
    }
}


// --- Funções Principais ---

// Busca TODOS os dados da aba selecionada (doGet modificado no Apps Script)
async function loadSheetData() {
    const selectedSheet = sheetSelect.value;
    if (!selectedSheet) {
        showStatus("Por favor, selecione uma turma/aba.", true);
        return;
    }

    showLoading(true);
    showStatus("Carregando dados da turma: " + selectedSheet + "...");
    tableHead.innerHTML = '<tr><th>Carregando Cabeçalho...</th></tr>';
    tableBody.innerHTML = '<tr><td>Carregando Alunos...</td></tr>';

    const fetchUrl = `${SCRIPT_URL}?sheet=${encodeURIComponent(selectedSheet)}`;
    console.log("Attempting to fetch sheet data from:", fetchUrl);

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            let errorMsg = `Erro HTTP ${response.status}. Não foi possível buscar dados da turma.`;
            try { const errorData = await response.json(); if (errorData && errorData.message) errorMsg += ` Detalhe: ${errorData.message}`; } catch (e) {/* Ignora */}
            throw new Error(errorMsg);
        }
        const data = await response.json();
         if (data.status === 'error') { throw new Error(data.message || "Erro retornado pelo Apps Script."); }
         if (!data.headers || !data.students) { throw new Error("Resposta do servidor em formato inesperado."); }

        // *** CHAMA A FUNÇÃO DE RENDERIZAÇÃO (QUE AGORA FORMATARÁ AS DATAS) ***
        renderAttendanceTable(data.headers, data.students);
        showStatus("Dados da turma carregados.", false);
         if (data.message) { showStatus(updateStatusElement.textContent + " | Aviso: " + data.message, false); }

    } catch (error) {
        console.error("Erro ao buscar dados da planilha:", error);
        showStatus(`Erro ao carregar dados: ${error.message}`, true);
         tableHead.innerHTML = '<tr><th>Erro</th></tr>';
         tableBody.innerHTML = '<tr><td>Não foi possível carregar os dados. Verifique o console (F12).</td></tr>';
    } finally {
        showLoading(false);
    }
}

// Renderiza a tabela completa de presença (MODIFICADA para usar formatHeaderDateToDDMM)
function renderAttendanceTable(originalHeaders, students) {
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    // 1. Cria o cabeçalho da tabela (Thead) E FORMATA AS DATAS
    const headerRow = tableHead.insertRow();
    const thName = document.createElement('th');
    thName.textContent = 'Nome do Aluno';
    headerRow.appendChild(thName);

    // Array para guardar os cabeçalhos formatados para usar depois nos data-attributes
    const formattedHeaders = [];

    if (!originalHeaders || originalHeaders.length === 0) {
        console.warn("Nenhum cabeçalho de data recebido do script.");
    } else {
        originalHeaders.forEach(originalHeader => {
            const thDate = document.createElement('th');
            // *** FORMATA A DATA AQUI usando a nova função auxiliar ***
            const formattedDate = formatHeaderDateToDDMM(originalHeader);
            thDate.textContent = formattedDate; // Mostra a data formatada
            headerRow.appendChild(thDate);
            formattedHeaders.push(formattedDate); // Guarda a data formatada (DD/MM)
        });
    }

    // 2. Cria as linhas da tabela (Tbody) para cada aluno
    if (!students || students.length === 0) {
         const colspan = formattedHeaders.length + 1;
         tableBody.innerHTML = '<tr><td colspan="' + colspan + '">Nenhum aluno encontrado nesta turma.</td></tr>';
         return;
     }

    students.forEach(student => {
        if (!student || !student.name) return;

        const tr = tableBody.insertRow();
        const tdName = tr.insertCell();
        tdName.textContent = student.name;

        // Células de checkbox para cada data, usando os HEADERS FORMATADOS
        formattedHeaders.forEach((formattedDate, index) => {
            const tdCheck = tr.insertCell();
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.studentName = student.name;
            // *** GUARDA A DATA FORMATADA (DD/MM) no data-date ***
            // Isso garante que handleAttendanceChange envie o formato correto para doPost
            checkbox.dataset.date = formattedDate;

            checkbox.checked = (student.attendance && Array.isArray(student.attendance) && student.attendance[index] === true);

            // Opcional: Desabilitar checkbox se a data formatada não parecer válida (ex: ficou em branco)
             if (!formattedDate || !/^\d{1,2}\/\d{1,2}$/.test(formattedDate)) {
                 // checkbox.disabled = true;
                 // console.warn(`Checkbox para ${student.name} com data inválida ou não formatada: ${formattedDate}`);
             }

            checkbox.addEventListener('change', handleAttendanceChange);
            tdCheck.appendChild(checkbox);
        });
    });
}

// Lida com a mudança no estado de um checkbox (doPost - NENHUMA ALTERAÇÃO NECESSÁRIA AQUI)
// Copie a função handleAttendanceChange da versão anterior que você já tem.
async function handleAttendanceChange(event) {
    const checkbox = event.target;
    const studentName = checkbox.dataset.studentName;
    const dateString = checkbox.dataset.date; // Pega a data DD/MM do atributo data-date
    const isAbsent = checkbox.checked;
    const selectedSheet = sheetSelect.value;

    if (!selectedSheet || !dateString || !studentName) {
        console.error("Faltando dados (checkbox) para atualizar:", { selectedSheet, dateString, studentName });
        showStatus("Erro interno: Não foi possível identificar os dados do checkbox para atualização.", true);
        checkbox.checked = !isAbsent; return;
    }
     if (!/^\d{1,2}\/\d{1,2}$/.test(dateString)) { // Valida se a data no dataset é DD/MM
         console.error("Data inválida no checkbox:", dateString);
         showStatus(`Erro: Data inválida (${dateString}) associada ao checkbox. Atualização cancelada.`, true);
         checkbox.checked = !isAbsent; return;
     }


    showStatus(`Atualizando ${studentName} em ${dateString}...`);
    const payload = { sheet: selectedSheet, student: studentName, date: dateString, absent: isAbsent };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST', cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload), redirect: 'follow'
        });
        if (!response.ok) {
             let errorMsg = `Erro HTTP ${response.status} ao atualizar.`;
             try { const errorData = await response.json(); if (errorData && errorData.message) errorMsg += ` Detalhe: ${errorData.message}`; } catch (e) {/* Ignora */}
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
        checkbox.checked = !isAbsent;
    }
}

// --- Inicialização ---
window.addEventListener('DOMContentLoaded', (event) => {
    loadSheetButton.addEventListener('click', loadSheetData);
     showStatus("Selecione uma turma e clique em 'Carregar Turma'.");
});