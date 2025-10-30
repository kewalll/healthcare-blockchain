from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.runnables import RunnableParallel, RunnablePassthrough
import os
from dotenv import load_dotenv
import tempfile
from PyPDF2 import PdfReader
import time

# ==============================
# Load Environment Variables
# ==============================
load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    raise ValueError("❌ GROQ_API_KEY not found. Please check your .env file.")

os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")

# ==============================
# FastAPI Initialization
# ==============================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# Request Models
# ==============================
class ChatRequest(BaseModel):
    message: str


# ==============================
# Medical Assistant Prompt
# ==============================
prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a knowledgeable and empathetic medical assistant. "
        "Always respond in a clear, structured format using bullet points. "
        "Your answers must:\n"
        "- Be concise, accurate, and medically relevant.\n"
        "- Use section headers in bold (**Causes**, **Symptoms**, **Treatment**, **Prevention**).\n"
        "- Use bullet points for clarity.\n"
        "- Avoid long paragraphs.\n"
        "- For lifestyle questions, use: **What to avoid**, **When to avoid**, **Why to avoid**."
    ),
    ("user", "Question: {question}"),
])

# ==============================
# Groq LLM Setup
# ==============================
llm = ChatGroq(
    groq_api_key=groq_api_key,
    model="llama-3.1-8b-instant",  # ✅ new arg name (was model_name before)
    temperature=0
)

output_parser = StrOutputParser()
chain = prompt | llm | output_parser

# ==============================
# Embeddings + FAISS Setup
# ==============================
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")
vectorstore = None  # global (in-memory)


# ==============================
# Chat Endpoint
# ==============================
@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        response = chain.invoke({"question": req.message})
        return {"reply": response}
    except Exception as e:
        return {"reply": f"⚠️ Error: {str(e)}"}


# ==============================
# Upload Document Endpoint
# ==============================
@app.post("/upload-doc")
async def upload_document(file: UploadFile = File(...)):
    global vectorstore
    try:
        # Save temporarily
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            tmp_file.write(await file.read())
            tmp_path = tmp_file.name

        # Read file content
        file_content = ""
        if file.filename.endswith(".txt") or file.filename.endswith(".md"):
            with open(tmp_path, "r", encoding="utf-8") as f:
                file_content = f.read()
        elif file.filename.endswith(".pdf"):
            reader = PdfReader(tmp_path)
            file_content = " ".join(
                [page.extract_text() for page in reader.pages if page.extract_text()]
            )
        else:
            return {"error": "❌ Unsupported file format. Use .txt, .md, or .pdf"}

        # Split text into chunks
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        docs = splitter.split_documents([Document(page_content=file_content)])

        # Create FAISS vectorstore
        vectorstore = FAISS.from_documents(docs, embeddings)

        # Simulate delay for large docs (optional)
        for i, _ in enumerate(docs):
            if i > 0 and i % 5 == 0:
                print("Pausing to respect API rate limits...")
                time.sleep(2)

        return {"message": f"✅ Document '{file.filename}' uploaded and indexed successfully!"}

    except Exception as e:
        return {"error": f"⚠️ Error: {str(e)}"}


# ==============================
# Document Q&A Endpoint
# ==============================
@app.post("/doc-qna")
async def document_qna(req: ChatRequest):
    global vectorstore
    if not vectorstore:
        return {"reply": "⚠️ No document uploaded yet. Please upload a document first."}

    try:
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        docs = retriever.invoke(req.message)

        # Fallback to general assistant if no relevant docs
        if not docs or all(len(d.page_content.strip()) == 0 for d in docs):
            response = chain.invoke({"question": req.message})
            return {"reply": response}

        qa_prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are a medical assistant. You have both a document context and medical knowledge. "
                "If the document is relevant, use it; otherwise, rely on your general expertise. "
                "Always answer in structured bullet points with clear section headers.\n\n"
                "Here is the document context:\n{context}"
            ),
            ("user", "{question}")
        ])

        # ✅ Build retrieval-based pipeline using Runnables
        retrieval_chain = (
            RunnableParallel(
                {"context": retriever, "question": RunnablePassthrough()}
            )
            | qa_prompt
            | llm
            | StrOutputParser()
        )

        result = retrieval_chain.invoke(req.message)
        return {"reply": result}

    except Exception as e:
        return {"reply": f"⚠️ Error: {str(e)}"}


# ==============================
# History Summarizer Endpoint
# ==============================
class SummarizerRequest(BaseModel):
    caseTitles: list[str]


@app.post("/summarizer")
async def summarize_details(req: SummarizerRequest):
    try:
        case_titles = req.caseTitles
        if not case_titles:
            return {"summary": "⚠️ No case titles provided."}

        combined_cases = "\n".join([f"- {title}" for title in case_titles])

        summary_prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are a helpful assistant that writes simple medical summaries for patients. "
                "Summarize the given case titles in 2–4 easy sentences, avoiding medical jargon."
            ),
            ("user", f"Case records:\n{combined_cases}")
        ])

        summary_chain = summary_prompt | llm | StrOutputParser()
        result = summary_chain.invoke({})
        return {"summary": result}

    except Exception as e:
        return {"summary": f"⚠️ Error generating summary: {str(e)}"}
