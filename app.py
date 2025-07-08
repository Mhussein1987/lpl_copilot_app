import streamlit as st
import openai
import os
from dotenv import load_dotenv
import tempfile
import faiss
import pickle
from sentence_transformers import SentenceTransformer
import numpy as np

# === Load environment variables ===
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

# === CONFIGURATION ===
openai.api_key = os.getenv("OPENAI_API_KEY")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# === Mock account data ===
mock_statements = {
    "John Doe": "https://example.com/statements/john-doe-statement.pdf",
    "Jane Smith": "https://example.com/statements/jane-smith-statement.pdf"
}

# === Mock chat history ===
mock_history = {
    "John Doe": [
        "Client called on Monday about a transfer delay.",
        "Requested a status update on Wednesday.",
        "Now requesting escalation due to inactivity."
    ],
    "Jane Smith": [
        "Client inquired about tax documents.",
        "Asked for 2023 and 2024 statements."
    ]
}

# === Session State Init ===
if "logged_in_user" not in st.session_state:
    st.session_state.logged_in_user = None

if "chat_mode" not in st.session_state:
    st.session_state.chat_mode = "Client"

if "vector_store" not in st.session_state:
    st.session_state.vector_store = None
    st.session_state.doc_chunks = []

if "messages" not in st.session_state:
    st.session_state.messages = []

# === Page Configuration ===
st.set_page_config(page_title="LPL Co-Pilot Chatbot", layout="wide")

# Inject custom CSS for mobile responsiveness
st.markdown('''
    <style>
    @media (max-width: 600px) {
        .block-container {
            padding-left: 0.5rem !important;
            padding-right: 0.5rem !important;
        }
        .stChatInput input, .stTextInput input {
            font-size: 1.1rem !important;
            min-height: 48px !important;
        }
        .stChatMessage, .stMarkdown, .stButton, .stSelectbox, .stRadio, .stSubheader, .stTitle {
            font-size: 1.05rem !important;
        }
        .stSidebar {
            width: 90vw !important;
            min-width: 200px !important;
        }
    }
    </style>
''', unsafe_allow_html=True)

# === Sidebar: Mode + Login ===
st.sidebar.image("/Users/mustafahussein/Desktop/images.png", width=84)
st.sidebar.title("Settings")
mode = st.sidebar.radio("Select Mode", ["Client", "Agent Assist", "RAG Q&A", "ChatGPT API"])
st.session_state.chat_mode = mode

user = st.sidebar.selectbox("Login as", ["None"] + list(mock_statements.keys()))
if user != "None":
    st.session_state.logged_in_user = user
else:
    st.session_state.logged_in_user = None

st.sidebar.write(f"🔐 Logged in: {st.session_state.logged_in_user or 'No user'}")

# === UI Header ===
st.title("LPL Co-Pilot Chatbot")
st.write("Hi, I’m your Co-Pilot! How can I help you today?")

# Display previous messages
for msg in st.session_state.messages:
    st.chat_message(msg["role"]).markdown(msg["content"])

# === MAIN MODE LOGIC ===

# === CLIENT MODE ===
if mode == "Client":
    st.subheader("Client Self-Service")
    # Move the chat input up by 500% only for mobile preview (target the correct textarea class)
    st.markdown('''
        <style>
        @media (max-width: 600px) {
            .center-mobile-search { display: flex; justify-content: center; position: relative; }
            .center-mobile-search textarea[data-testid="stChatInputTextArea"] {
                width: 100% !important;
                max-width: 400px !important;
                position: relative !important;
                top: -500% !important;
            }
        }
        </style>
    ''', unsafe_allow_html=True)
    st.markdown('<div class="center-mobile-search">', unsafe_allow_html=True)
    query = st.chat_input("Ask something (e.g., 'get my latest statement')")
    st.markdown('</div>', unsafe_allow_html=True)

    if query:
        st.chat_message("user").markdown(query)

        if "statement" in query.lower():
            user = st.session_state.logged_in_user
            if user and user in mock_statements:
                url = mock_statements[user]
                response = f"Here’s your latest statement: [Download PDF]({url})"
            else:
                response = "Please log in to access your account statement."
        else:
            # Updated for OpenAI v1+ API
            client = openai.OpenAI(api_key=openai.api_key)
            chat_response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a helpful financial assistant."},
                    {"role": "user", "content": query}
                ]
            )
            response = chat_response.choices[0].message.content

        st.session_state.messages.append({"role": "assistant", "content": response})
        st.chat_message("assistant").markdown(response)

# === AGENT ASSIST MODE ===
elif mode == "Agent Assist":
    st.subheader("Agent Assist Mode")
    user = st.session_state.logged_in_user

    # Use mock_statements for login, but provide mock chat history for demo
    if user and user in mock_statements:
        history = mock_history.get(user, [])
        history_text = "\n".join(history)

        st.write("### 🗃 Client History")
        for line in history:
            st.markdown(f"- {line}")

        if st.button("Summarize History & Suggest Reply"):
            summary_prompt = f"Summarize this client history and suggest a professional, empathetic response:\n{history_text}"

            # Updated for OpenAI v1+ API
            client = openai.OpenAI(api_key=openai.api_key)
            summary_response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a customer service expert."},
                    {"role": "user", "content": summary_prompt}
                ]
            )
            summary = summary_response.choices[0].message.content

            st.write("### ✍ Suggested Response")
            st.markdown(summary)
    else:
        st.warning("Please log in as a client to view their interaction history.")

# === RAG Q&A MODE ===
elif mode == "RAG Q&A":
    st.subheader("RAG: Ask Questions from Uploaded Documents")

    uploaded_file = st.file_uploader("Upload a policy or FAQ document", type=["txt", "md"])
    question = st.text_input("Ask a question based on the document")

    if uploaded_file and st.button("Process Document"):
        doc_text = uploaded_file.read().decode("utf-8")
        doc_chunks = [doc_text[i:i+500] for i in range(0, len(doc_text), 500)]

        # Embed and store in FAISS
        embeddings = embedding_model.encode(doc_chunks)
        index = faiss.IndexFlatL2(embeddings.shape[1])
        index.add(np.array(embeddings))

        st.session_state.vector_store = index
        st.session_state.doc_chunks = doc_chunks

        st.success("Document processed and indexed!")

    if question and st.session_state.vector_store:
        q_embedding = embedding_model.encode([question])
        D, I = st.session_state.vector_store.search(np.array(q_embedding), k=3)
        retrieved_chunks = [st.session_state.doc_chunks[i] for i in I[0]]

        context = "\n".join(retrieved_chunks)
        answer_prompt = f"Use the following information to answer the question:\n{context}\n\nQuestion: {question}"

        # Updated for OpenAI v1+ API
        client = openai.OpenAI(api_key=openai.api_key)
        answer_response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert assistant extracting policy answers."},
                {"role": "user", "content": answer_prompt}
            ]
        )
        answer = answer_response.choices[0].message.content

        st.markdown("### 💡 Answer")
        st.markdown(answer)

# === ChatGPT API Mode ===
elif mode == "ChatGPT API":
    st.subheader("ChatGPT API Playground")
    chatgpt_messages = st.session_state.get("chatgpt_messages", [])
    for msg in chatgpt_messages:
        st.chat_message(msg["role"]).markdown(msg["content"])
    chatgpt_input = st.chat_input("Ask ChatGPT anything...")
    if chatgpt_input:
        st.chat_message("user").markdown(chatgpt_input)
        client = openai.OpenAI(api_key=openai.api_key)
        chat_response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": chatgpt_input}]
        )
        answer = chat_response.choices[0].message.content
        st.session_state.setdefault("chatgpt_messages", []).append({"role": "user", "content": chatgpt_input})
        st.session_state["chatgpt_messages"].append({"role": "assistant", "content": answer})
        st.chat_message("assistant").markdown(answer)
