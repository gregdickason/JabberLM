import { Trainer } from '../src/engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG, DEFAULT_MODEL_CONFIG, type ModelConfig } from '../src/engine/config'
import { buildMoeCorpus, sortHeldOut, maxHeldOut, reverseHeldOut } from '../src/data/tasks'
import { taskAccuracy } from '../src/interp/ablation'
const STEPS = Number(process.env.STEPS ?? 3000)
const cfg: ModelConfig = { ...DEFAULT_MODEL_CONFIG, dModel: 48, nHeads: 3, nLayers: 3, contextLen: 48, dFF: 192 } // dense default
const corpus = buildMoeCorpus(20000)
const trainer = new Trainer(corpus, cfg, 1337)
const tc = { ...DEFAULT_TRAIN_CONFIG, batchSize: 24, learningRate: 0.006 }
const nP = trainer.model.params.reduce((n,p)=>n+p.size,0)
console.log(`DENSE default ${nP.toLocaleString()} params · vocab ${trainer.tok.vocabSize} · ${STEPS} steps`)
const evalAll = (s:number)=>{
  const so=taskAccuracy(trainer.model,trainer.tok,'sort',sortHeldOut().slice(0,30))
  const mx=taskAccuracy(trainer.model,trainer.tok,'max',maxHeldOut().slice(0,30))
  const rv=taskAccuracy(trainer.model,trainer.tok,'reverse',reverseHeldOut().slice(0,30))
  console.log(`  step ${s}: sort ${so}%  max ${mx}%  rev ${rv}%`)
}
const t0=Date.now()
for(let i=1;i<=STEPS;i++){ trainer.stepBatch(tc,DEFAULT_FEATURE_FLAGS); if(i%500===0){ process.stdout.write(''); evalAll(i) } }
console.log(`trained ${STEPS} in ${((Date.now()-t0)/1000).toFixed(0)}s (${(STEPS/((Date.now()-t0)/1000)).toFixed(1)} steps/s)`)
