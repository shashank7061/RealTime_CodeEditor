import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRightIcon } from '../components/Icons';

function createRoomId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function Home() {
    const navigate = useNavigate();
    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');

    const createNewRoom = (e) => {
        e.preventDefault();
        const id = createRoomId();
        setRoomId(id);
        toast.success('Created a new room');
    };

    const joinRoom = () => {
        if (!roomId || !username) {
            toast.error('Room ID and Username are required');
            return;
        }
        navigate(`/editor/${roomId}`, {
            state: { username },
        });
    };

    const handleInputEnter = (e) => {
        if (e.code === 'Enter') {
            joinRoom();
        }
    };

    return (
        <div className="homePage">
            <header className="homeTopbar">
                <div className="homeBrand">
                    <img src="/images/synccode_logo_highres.png" alt="" />
                    SyncCode
                </div>
                <span className="homeTopbar__status">v1 · realtime</span>
            </header>

            <main className="homeMain">
                <section className="homeCard" aria-label="Join room">
                    <div className="homeHeading">
                        <h1>Open a session</h1>
                        <p>Paste a room ID to join your team, or generate a new one.</p>
                    </div>

                    <div className="homeForm">
                        <div className="homeField">
                            <label htmlFor="roomId">Room ID</label>
                            <div className="homeField__control">
                                <input
                                    id="roomId"
                                    className="mono"
                                    type="text"
                                    placeholder="xxxxxxxx-xxxx-xxxx"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value)}
                                    onKeyUp={handleInputEnter}
                                    autoComplete="off"
                                    spellCheck="false"
                                />
                                <button
                                    type="button"
                                    id="generateRoomBtn"
                                    className="homeField__action"
                                    onClick={createNewRoom}
                                >
                                    Generate
                                </button>
                            </div>
                        </div>

                        <div className="homeField">
                            <label htmlFor="username">Display name</label>
                            <input
                                id="username"
                                type="text"
                                placeholder="How others will see you"
                                onChange={(e) => setUsername(e.target.value)}
                                value={username}
                                onKeyUp={handleInputEnter}
                                autoComplete="nickname"
                            />
                        </div>
                    </div>

                    <button type="button" id="joinRoomBtn" onClick={joinRoom} className="joinButton">
                        Join room
                        <ArrowRightIcon size={15} />
                    </button>

                    <p className="newRoomText">
                        Starting fresh?
                        <button
                            type="button"
                            onClick={createNewRoom}
                            className="createRoomButton"
                        >
                            Create a new room
                        </button>
                    </p>
                </section>
            </main>

            <footer className="homeFooter">
                <span>CRDT sync</span>
                <span>Video calls</span>
                <span>AI assistant</span>
            </footer>
        </div>
    );
}

export default Home;