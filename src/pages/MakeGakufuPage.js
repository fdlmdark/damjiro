import { useCardStyles, useMarginStyles } from '../App'
import { Typography, Card, CardHeader, Container } from '@material-ui/core'
import { Edit } from '@material-ui/icons'
import MIDIEditor from '../MIDIEditor'
import React from 'react'

const MakeGakufuPage = () => {
  const classes = useCardStyles()
  const marginClasses = useMarginStyles()

  return (
    <Container>
      <Card className={marginClasses.m3}>
        <CardHeader
          title={
            <Typography variant='h5'>
              <Edit className={classes.wrapIcon} />
              Make Damjiro Gakuhu.
            </Typography>
          }
        />
        <MIDIEditor />
      </Card>
    </Container>
  )
}
export default MakeGakufuPage
