import { Canvas } from '@react-three/fiber';
import BlackHole from './components/BlackHole';

function App() {
  return (
    <div className="h-screen w-screen">
      <Canvas>
        <color attach="background" args={['#130e16']} />
        <BlackHole />
      </Canvas>
    </div>
  );
}

export default App;