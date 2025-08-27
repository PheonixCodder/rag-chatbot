'use client';
import Image from 'next/image';
import logo from './assets/logo.png';
import { useOpenRouterChat } from '../hooks/useOpenRouterChat';
import { PromptSuggestionRow } from '../components/PromptSuggestionRow';
import { LoadingBubble } from '../components/LoadingBubble';
import { Bubble } from '../components/Bubble';

const Home = () => {
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
  } = useOpenRouterChat('/api/chat');

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    sendMessage(prompt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  const noMessages = messages.length === 0;

  return (
    <main>
      <Image src={logo} width="250" alt="logo" />
      <section className={noMessages ? '' : 'populated'}>
        {noMessages ? (
          <>
            <p className="starter-text">
              Ask an F1 question and get the latest answers.
            </p>
            <br />
            <PromptSuggestionRow onPromptClick={handlePromptClick} />
          </>
        ) : (
          <>
            {messages.map((message, index) => (
              <Bubble key={index} message={message} />
            ))}
            {isLoading && <LoadingBubble />}
          </>
        )}
      </section>
      <form onSubmit={handleSubmit}>
        <input
          className="question-box"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question"
        />
        <input type="submit" />
      </form>
    </main>
  );
};

export default Home;
