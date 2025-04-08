// ---------- CONFIGURAÇÃO OBRIGATÓRIA ----------
// --- COLE AQUI A URL ATUALIZADA DO SEU WEB APP (DEPOIS DE REIMPLANTAR O APPS SCRIPT) ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwGrqftuTE8dbqZl_Bp9nXqD21PJ5hQknpLzm2-W3qWJSbcaHBbgsmC6AAn6Q1TCY7g7w/exec"; // <<< COLOQUE A URL CORRETA DA NOVA IMPLANTAÇÃO
// ----------------------------------------------

// Elementos da página
const sheetSelect = document.getElementById('sheetSelect');
const loadSheetButton = document.getElementById('loadSheetButton'); // Novo botão
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

// --- Funções Principais ---

// Busca TODOS os dados da aba selecionada (doGet modificado no Apps Script)
async function loadSheetData() {
    const selectedSheet = sheetSelect.value;
    if (!selectedSheet) {
        showStatus("Por favor, selecione uma turma/aba.", true);
        return;
    }

    showLoading(true);
    showStatus("Carregando dados da turma: " + selectedSheet + "..."); // Mensagem inicial
    tableHead.innerHTML = '<tr><th>Carregando Cabeçalho...</th></tr>'; // Limpa cabeçalho antigo
    tableBody.innerHTML = '<tr><td>Carregando Alunos...</td></tr>'; // Limpa corpo antigo

    // Constrói a URL para o doGet com o parâmetro sheet
    const fetchUrl = `${SCRIPT_URL}?sheet=${encodeURIComponent(selectedSheet)}`;

    console.log("Attempting to fetch sheet data from:", fetchUrl); // Log para debug

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            let errorMsg = `Erro HTTP ${response.status}. Não foi possível buscar dados da turma.`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.message) errorMsg += ` Detalhe: ${errorData.message}`;
            } catch (e) { /* Ignora */}
            throw new Error(errorMsg);
        }

        const data = await response.json();

         if (data.status === 'error') {
             throw new Error(data.message || "Erro retornado pelo Apps Script.");
         }

         if (!data.headers || !data.students) {
             console.error("Formato de dados inesperado recebido:", data);
             throw new Error("Resposta do servidor em formato inesperado.");
         }

        renderAttendanceTable(data.headers, data.students); // Chama a nova função de renderização
        showStatus("Dados da turma carregados.", false); // Mensagem de sucesso ao carregar

         if (data.message) { // Mostra mensagens informativas (ex: estrutura mínima não encontrada)
             // Adiciona ao status existente ou mostra separadamente
             showStatus(updateStatusElement.textContent + " | Aviso: " + data.message, false);
         }


    } catch (error) {
        console.error("Erro ao buscar dados da planilha:", error);
        showStatus(`Erro ao carregar dados: ${error.message}`, true);
         // Limpa a tabela em caso de erro para não mostrar dados parciais/antigos
         tableHead.innerHTML = '<tr><th>Erro</th></tr>';
         tableBody.innerHTML = '<tr><td>Não foi possível carregar os dados. Verifique o console (F12). Pode ser um problema na URL do script ou na implantação.</td></tr>';
    } finally {
        showLoading(false);
    }
}

// Renderiza a tabela completa de presença
function renderAttendanceTable(headers, students) {
    // 1. Limpa a tabela existente
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    // 2. Cria o cabeçalho da tabela (Thead)
    const headerRow = tableHead.insertRow();
    const thName = document.createElement('th');
    thName.textContent = 'Nome do Aluno';
    headerRow.appendChild(thName);

    if (!headers || headers.length === 0) {
        // Se não houver cabeçalhos de data, exibe apenas o nome
        console.warn("Nenhum cabeçalho de data recebido.");
    } else {
        headers.forEach(date => {
            const thDate = document.createElement('th');
            thDate.textContent = date; // Data no formato DD/MM (ou o que vier do script)
            headerRow.appendChild(thDate);
        });
    }


    // 3. Cria as linhas da tabela (Tbody) para cada aluno
    if (!students || students.length === 0) {
         // Calcula colspan baseado no número real de headers + 1 (para nome)
         const colspan = (headers ? headers.length : 0) + 1;
         tableBody.innerHTML = '<tr><td colspan="' + colspan + '">Nenhum aluno encontrado nesta turma.</td></tr>';
         return;
     }

    students.forEach(student => {
        if (!student || !student.name) {
            console.warn("Linha de aluno inválida ou sem nome encontrada:", student);
            return; // Pula linha de aluno inválida
        }


        const tr = tableBody.insertRow();

        // Célula do nome do aluno
        const tdName = tr.insertCell();
        tdName.textContent = student.name;

        // Células de checkbox para cada data correspondente ao cabeçalho
        headers.forEach((date, index) => {
            const tdCheck = tr.insertCell();
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            // Associa os dados necessários ao checkbox
            checkbox.dataset.studentName = student.name;
            checkbox.dataset.date = date; // Guarda a data DD/MM do cabeçalho

            // Define o estado inicial do checkbox
            // Verifica se student.attendance existe, é um array e tem o índice
            checkbox.checked = (student.attendance && Array.isArray(student.attendance) && student.attendance[index] === true);

            // Adiciona o event listener para quando o checkbox mudar
            checkbox.addEventListener('change', handleAttendanceChange);

            tdCheck.appendChild(checkbox);
        });
    });
}

// Lida com a mudança no estado de um checkbox (doPost - Nenhuma mudança necessária aqui)
// Copie a função handleAttendanceChange da versão anterior que você já tem.
async function handleAttendanceChange(event) {
    const checkbox = event.target;
    const studentName = checkbox.dataset.studentName;
    const dateString = checkbox.dataset.date; // Pega a data do atributo data-date
    const isAbsent = checkbox.checked;
    const selectedSheet = sheetSelect.value; // Pega a aba selecionada

    if (!selectedSheet || !dateString || !studentName) {
        console.error("Faltando dados (checkbox) para atualizar:", { selectedSheet, dateString, studentName });
        showStatus("Erro interno: Não foi possível identificar os dados do checkbox para atualização.", true);
        checkbox.checked = !isAbsent; // Reverte visualmente
        return;
    }

    // Verifica se a data é válida (não vazia) antes de prosseguir
     if (!dateString) {
         console.error("Checkbox sem data associada não pode ser atualizado.");
         showStatus("Erro: Checkbox sem data válida.", true);
         checkbox.checked = !isAbsent; // Reverte
         return;
     }

    showStatus(`Atualizando ${studentName} em ${dateString}...`);

    const payload = {
        sheet: selectedSheet,
        student: studentName,
        date: dateString, // Envia DD/MM (ou o que estiver no data-date)
        absent: isAbsent
    };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
             redirect: 'follow'
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
        checkbox.checked = !isAbsent; // Reverte visualmente
    }
}

// --- Inicialização ---
window.addEventListener('DOMContentLoaded', (event) => {
    // Adiciona listener ao botão de carregar TURMA
    loadSheetButton.addEventListener('click', loadSheetData);
    // O listener para os checkboxes é adicionado dinamicamente em renderAttendanceTable
    // Não carregamos nada automaticamente ao iniciar, espera o botão.
     showStatus("Selecione uma turma e clique em 'Carregar Turma'."); // Mensagem inicial
});