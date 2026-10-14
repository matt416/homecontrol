import { useState, type FormEvent } from 'react';
import { exchangePairingCode, PairingError } from './api-client.js';

export function Pairing({
  onPair,
}: {
  onPair: (token: string, remember: boolean) => void;
}) {
  const [code, setCode] = useState('');
  const displayedCode =
    code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const token = await exchangePairingCode(code);
      onPair(token, true);
    } catch (error) {
      setError(
        error instanceof PairingError
          ? error.message
          : 'Could not reach your Mac. Check that HomeControl is running.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="pairing">
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <img
          className="pairing-mark"
          src="/homecontrol.png"
          alt=""
          width="76"
          height="76"
        />
        <h1>Connect your frame</h1>
        <p>Enter the code from HomeControl on your Mac → Settings.</p>

        <label htmlFor="code">Pairing code</label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{4}-[0-9]{4}"
          maxLength={9}
          value={displayedCode}
          onChange={(event) =>
            setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 8))
          }
          required
          autoComplete="one-time-code"
          spellCheck={false}
          placeholder="1234-5678"
        />
        <button
          className="primary-button"
          disabled={pending || code.length !== 8}
        >
          {pending ? 'Connecting…' : 'Connect'}
        </button>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
