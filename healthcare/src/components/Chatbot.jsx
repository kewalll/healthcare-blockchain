import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import chatbot from "../icons/chatbot.png";
import remove from "../icons/remove.png";

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [file, setFile] = useState(null);
    const [docUploaded, setDocUploaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto scroll to bottom when new messages arrive
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Focus input when chatbot opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    // Send message (decides endpoint automatically)
    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = { sender: "user", text: input };
        setMessages((prev) => [...prev, userMessage]);

        // Clear input immediately
        const messageToSend = input;
        setInput("");
        setIsLoading(true);

        try {
            const endpoint = docUploaded
                ? "http://localhost:8003/doc-qna"
                : "http://localhost:8003/chat";

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: messageToSend }),
            });

            const data = await res.json();
            const botMessage = { sender: "bot", text: data.reply };
            setMessages((prev) => [...prev, botMessage]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { sender: "bot", text: "⚠️ Error: Could not connect to server." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle file upload
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        setIsLoading(true);

        try {
            const res = await fetch("http://localhost:8003/upload-doc", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (data.message) {
                setDocUploaded(true);
                setMessages((prev) => [
                    ...prev,
                    { sender: "bot", text: data.message },
                ]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    { sender: "bot", text: data.error || "❌ Upload failed" },
                ]);
            }
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { sender: "bot", text: "⚠️ Error uploading document." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            {/* Floating Chat Icon */}
            <div
                className={`fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl cursor-pointer transition-all duration-300 transform hover:scale-110 ${isOpen
                    ? 'bg-red-500 hover:bg-red-600 rotate-90'
                    : 'bg-gradient-to-br from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800'
                    }`}
                onClick={toggleChat}
            >
                {isOpen ? (
                    <img src={remove} alt="cross" />
                ) : (
                    <img src={chatbot} alt="chatbot" />
                )}
            </div>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-[500px] h-[580px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-slideUp">
                    {/* Header */}
                    <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-700 text-white flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="font-semibold text-lg">MedLedger Assistant</span>
                        </div>
                        <button
                            onClick={toggleChat}
                            className="text-white hover:bg-white/20 p-1 rounded-full transition-colors duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-800">
                        {messages.length === 0 && (
                            <div className="text-center text-gray-400 py-8">
                                <div className="text-4xl mb-2">🤖</div>
                                <p className="text-sm">Hello! I'm your MedLedger assistant.</p>
                                <p className="text-xs mt-1">
                                    {docUploaded
                                        ? "Ask me about your document!"
                                        : "Upload a document or ask me anything!"
                                    }
                                </p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-fadeIn`}
                            >
                                <div
                                    className={`p-3 rounded-2xl text-sm max-w-[90%] shadow-lg ${msg.sender === "user"
                                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-md"
                                        : "bg-gray-700 text-gray-100 rounded-bl-md border border-gray-600"
                                        }`}
                                >
                                    <ReactMarkdown>
                                        {msg.text}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start animate-fadeIn">
                                <div className="bg-gray-700 text-gray-100 p-3 rounded-2xl rounded-bl-md border border-gray-600">
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input + Upload */}
                    <div className="p-3 bg-gray-900 border-t border-gray-700">
                        <div className="flex items-center space-x-2 bg-gray-800 rounded-xl border border-gray-600 focus-within:border-blue-500 transition-colors duration-200">
                            {/* Hidden file input */}
                            <input
                                type="file"
                                id="fileUpload"
                                className="hidden"
                                onChange={handleFileChange}
                                disabled={isLoading}
                            />

                            {/* Paperclip Button */}
                            <label
                                htmlFor="fileUpload"
                                className={`px-2 cursor-pointer text-gray-400 hover:text-blue-400 transition-colors duration-200 ${isLoading ? 'cursor-not-allowed opacity-50' : ''
                                    }`}
                                title="Upload document"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                            </label>

                            <input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                placeholder={
                                    docUploaded
                                        ? "Ask about your document..."
                                        : "Type your message..."
                                }
                                className="flex-1 px-3 py-3 text-sm bg-transparent text-gray-100 placeholder-gray-400 outline-none"
                                disabled={isLoading}
                            />

                            <button
                                onClick={sendMessage}
                                disabled={!input.trim() || isLoading}
                                className={`px-3 py-4 rounded-lg text-sm font-medium transition-all duration-200 ${!input.trim() || isLoading
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 shadow-lg'
                                    }`}
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {docUploaded && (
                            <div className="flex items-center mt-2 text-xs text-green-400">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Document uploaded - Ready for Q&A
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-slideUp {
                    animation: slideUp 0.3s ease-out;
                }

                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default Chatbot;

